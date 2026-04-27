import { Component, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { fromHoleLocalCoordinates, resolveHoleAxis } from '../services/holeAxis';
import { GeoPoint, HoleLayoutGeometry } from '../types/play';

function getMapLibre(): any {
  try {
    return require('@maplibre/maplibre-react-native');
  } catch {
    return null;
  }
}

type MapErrorBoundaryProps = { onError: () => void; fallback: ReactNode; children: ReactNode };
class MapErrorBoundary extends Component<MapErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

type Props = {
  geometry: HoleLayoutGeometry;
  playerPosition: GeoPoint | null;
  caddyHeatmap?: CaddyMapHeatmap | null;
};

export type CaddyMapHeatmap = {
  origin: GeoPoint;
  bearing: number;
  cells: CaddyMapHeatmapCell[];
};

export type CaddyMapHeatmapCell = {
  id: string;
  forwardMeters: number;
  lateralMeters: number;
  count: number;
  percentage: number;
  intensity: number;
};

const toPolygonFeature = (id: string, polygon: GeoPoint[], color: string) => ({
  type: 'Feature',
  id,
  properties: { color },
  geometry: { type: 'Polygon', coordinates: [polygon.map((point) => [point.lng, point.lat])] }
});

const toPointFeature = (id: string, point: GeoPoint, color: string) => ({
  type: 'Feature',
  id,
  properties: { color },
  geometry: { type: 'Point', coordinates: [point.lng, point.lat] }
});

const toFeatureCollection = (geometry: HoleLayoutGeometry, playerPosition: GeoPoint | null) => {
  const features: any[] = [];
  if (geometry.greenPolygon.length >= 3) features.push(toPolygonFeature('green', geometry.greenPolygon, '#22c55e88'));
  if (geometry.fairwayPolygon.length >= 3) features.push(toPolygonFeature('fairway', geometry.fairwayPolygon, '#16a34a66'));
  geometry.bunkerPolygons.forEach((polygon, index) => polygon.length >= 3 && features.push(toPolygonFeature(`bunker_${index}`, polygon, '#eab30888')));
  geometry.treesPolygons.forEach((polygon, index) => polygon.length >= 3 && features.push(toPolygonFeature(`trees_${index}`, polygon, '#15803d77')));
  geometry.obPolygons.forEach((polygon, index) => polygon.length >= 3 && features.push(toPolygonFeature(`ob_${index}`, polygon, '#dc262688')));
  if (geometry.teePoint) features.push(toPointFeature('tee', geometry.teePoint, '#ef4444'));
  if (playerPosition) features.push(toPointFeature('player', playerPosition, '#0ea5e9'));

  return { type: 'FeatureCollection', features };
};

const toHeatmapFeatureCollection = (heatmap: CaddyMapHeatmap | null | undefined) => {
  if (!heatmap) {
    return { type: 'FeatureCollection', features: [] };
  }

  const cellSizeMeters = 10;
  const halfCell = cellSizeMeters / 2;

  const features = heatmap.cells.map((cell) => {
    const corners = [
      { forward: cell.forwardMeters - halfCell, lateral: cell.lateralMeters - halfCell },
      { forward: cell.forwardMeters - halfCell, lateral: cell.lateralMeters + halfCell },
      { forward: cell.forwardMeters + halfCell, lateral: cell.lateralMeters + halfCell },
      { forward: cell.forwardMeters + halfCell, lateral: cell.lateralMeters - halfCell },
      { forward: cell.forwardMeters - halfCell, lateral: cell.lateralMeters - halfCell }
    ];

    return {
      type: 'Feature',
      id: cell.id,
      properties: {
        count: cell.count,
        percentage: `${cell.percentage}%`,
        intensity: cell.intensity
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          corners.map((corner) => {
            const point = fromHoleLocalCoordinates(heatmap.origin, heatmap.bearing, corner.forward, corner.lateral);
            return [point.lng, point.lat];
          })
        ]
      }
    };
  });

  return { type: 'FeatureCollection', features };
};

export function HolePlayMap({ geometry, playerPosition, caddyHeatmap }: Props) {
  const [MapLibre, setMapLibre] = useState<any>(null);
  const [mapNativeFailed, setMapNativeFailed] = useState(false);
  const axis = useMemo(() => resolveHoleAxis(geometry), [geometry]);
  const heatmapShape = useMemo(() => toHeatmapFeatureCollection(caddyHeatmap), [caddyHeatmap]);

  useEffect(() => {
    setMapLibre(getMapLibre());
  }, []);

  const center = playerPosition ?? geometry.teePoint ?? axis?.origin ?? { lat: 59.3293, lng: 18.0686 };

  if (!MapLibre || mapNativeFailed) {
    return (
      <View style={styles.missingWrap}>
        <Text style={styles.info}>
          {Platform.OS === 'web'
            ? 'Kartvy visas i mobilappen.'
            : 'Kartvy kräver development build (MapLibre finns inte i Expo Go).'}
        </Text>
      </View>
    );
  }

  return (
    <MapErrorBoundary
      onError={() => setMapNativeFailed(true)}
      fallback={
        <View style={styles.missingWrap}>
          <Text style={styles.info}>Kartvy kunde inte laddas i denna miljö.</Text>
        </View>
      }
    >
      <MapLibre.MapView style={StyleSheet.absoluteFill} logoEnabled={false} compassEnabled styleURL="https://demotiles.maplibre.org/style.json">
        <MapLibre.Camera centerCoordinate={[center.lng, center.lat]} zoomLevel={16} heading={axis?.bearing ?? 0} animationDuration={300} />
        <MapLibre.ShapeSource id="hole-play-shapes" shape={toFeatureCollection(geometry, playerPosition)}>
          <MapLibre.FillLayer id="hole-play-fill" style={{ fillColor: ['get', 'color'] }} />
          <MapLibre.CircleLayer id="hole-play-points" style={{ circleColor: ['get', 'color'], circleRadius: 6 }} />
        </MapLibre.ShapeSource>
        <MapLibre.ShapeSource id="caddy-heatmap" shape={heatmapShape}>
          <MapLibre.FillLayer
            id="caddy-heatmap-fill"
            style={{
              fillColor: [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0,
                '#f1f5f9',
                0.25,
                '#f0f1d9',
                0.5,
                '#dfee9a',
                0.75,
                '#bbeb6c',
                1,
                '#22c55e'
              ],
              fillOpacity: 0.72,
              fillOutlineColor: '#14532d'
            }}
          />
          <MapLibre.SymbolLayer
            id="caddy-heatmap-labels"
            style={{
              textField: ['get', 'percentage'],
              textSize: 11,
              textColor: '#0f172a',
              textHaloColor: '#ffffff',
              textHaloWidth: 1
            }}
          />
        </MapLibre.ShapeSource>
      </MapLibre.MapView>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  missingWrap: { flex: 1, justifyContent: 'center', padding: 12, backgroundColor: '#e2e8f0' },
  info: { color: '#334155', fontSize: 12 }
});
