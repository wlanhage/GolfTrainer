import { Component, type ReactNode, useEffect, useMemo, useState } from 'react';
import { ImageBackground, Platform, StyleSheet, Text, View } from 'react-native';
import { resolveHoleAxis } from '../services/holeAxis';
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
  useFallbackBackground?: boolean;
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

const FALLBACK_IMAGE_URI =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/OSM_Seattle_Mapnik.png/1024px-OSM_Seattle_Mapnik.png';

export function HolePlayMap({ geometry, playerPosition, useFallbackBackground = false }: Props) {
  const [MapLibre, setMapLibre] = useState<any>(null);
  const [mapNativeFailed, setMapNativeFailed] = useState(false);
  const axis = useMemo(() => resolveHoleAxis(geometry), [geometry]);

  useEffect(() => {
    setMapLibre(getMapLibre());
  }, []);

  const center = playerPosition ?? geometry.teePoint ?? axis?.origin ?? { lat: 59.3293, lng: 18.0686 };

  if (!MapLibre || mapNativeFailed) {
    if (useFallbackBackground) {
      return (
        <ImageBackground source={{ uri: FALLBACK_IMAGE_URI }} resizeMode="cover" style={styles.fallbackImage}>
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackTitle}>Dev fallback-karta aktiv</Text>
            <Text style={styles.fallbackInfo}>Byt av i inställningar när MapLibre fungerar.</Text>
          </View>
        </ImageBackground>
      );
    }

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
      </MapLibre.MapView>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallbackImage: { flex: 1, justifyContent: 'flex-end' },
  fallbackBadge: { margin: 12, backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 10, padding: 10, gap: 2 },
  fallbackTitle: { color: '#fff', fontWeight: '700' },
  fallbackInfo: { color: '#e2e8f0', fontSize: 12 },
  missingWrap: { flex: 1, justifyContent: 'center', padding: 12, backgroundColor: '#e2e8f0' },
  info: { color: '#334155', fontSize: 12 }
});
