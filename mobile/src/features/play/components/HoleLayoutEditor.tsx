import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveHoleAxis } from '../services/holeAxis';
import { applyPolygonToLayer, clearLayer, convertStrokeToPolygon } from '../services/holeLayoutGeometry';
import { hasRequiredLayout, resolveLayoutMappingStatus } from '../services/holeLayoutStatus';
import { GeoPoint, HoleLayoutGeometry, HoleLayoutLayer } from '../types/play';
import { HoleLayoutToolbar } from './HoleLayoutToolbar';
import { HoleMapCanvasOverlay } from './HoleMapCanvasOverlay';

let MapLibre: any;
try {
  MapLibre = require('@maplibre/maplibre-react-native');
} catch {
  MapLibre = null;
}

const DEFAULT_CENTER = { lat: 59.3293, lng: 18.0686 };
const TOOL_MODE = { navigate: 'navigate', draw: 'draw' } as const;

const getPolygonCenter = (polygon: GeoPoint[]) => {
  if (polygon.length === 0) return null;
  const sum = polygon.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
};

const resolveInitialCenter = (geometry: HoleLayoutGeometry): GeoPoint => {
  if (geometry.teePoint) return geometry.teePoint;
  const greenCenter = getPolygonCenter(geometry.greenPolygon);
  if (greenCenter) return greenCenter;
  const fairwayCenter = getPolygonCenter(geometry.fairwayPolygon);
  if (fairwayCenter) return fairwayCenter;
  return DEFAULT_CENTER;
};

const toPolygonFeature = (id: string, polygon: GeoPoint[], color: string) => ({
  type: 'Feature',
  id,
  properties: { color },
  geometry: { type: 'Polygon', coordinates: [polygon.map((point) => [point.lng, point.lat])] }
});

const toPointFeature = (point: GeoPoint) => ({
  type: 'Feature',
  id: 'tee-point',
  properties: { color: '#ef4444' },
  geometry: { type: 'Point', coordinates: [point.lng, point.lat] }
});

const toFeatureCollection = (geometry: HoleLayoutGeometry) => {
  const features: any[] = [];
  if (geometry.greenPolygon.length >= 3) features.push(toPolygonFeature('green', geometry.greenPolygon, '#22c55e88'));
  if (geometry.fairwayPolygon.length >= 3) features.push(toPolygonFeature('fairway', geometry.fairwayPolygon, '#16a34a66'));
  geometry.bunkerPolygons.forEach((polygon, index) => polygon.length >= 3 && features.push(toPolygonFeature(`bunker_${index}`, polygon, '#eab30888')));
  geometry.treesPolygons.forEach((polygon, index) => polygon.length >= 3 && features.push(toPolygonFeature(`trees_${index}`, polygon, '#15803d77')));
  geometry.obPolygons.forEach((polygon, index) => polygon.length >= 3 && features.push(toPolygonFeature(`ob_${index}`, polygon, '#dc262688')));
  if (geometry.teePoint) features.push(toPointFeature(geometry.teePoint));

  return { type: 'FeatureCollection', features };
};

type Props = {
  geometry: HoleLayoutGeometry;
  onChange: (geometry: HoleLayoutGeometry) => void;
  onSave?: () => void;
};

export function HoleLayoutEditor({ geometry, onChange, onSave }: Props) {
  const [activeLayer, setActiveLayer] = useState<HoleLayoutLayer>('tee');
  const [mode, setMode] = useState<(typeof TOOL_MODE)[keyof typeof TOOL_MODE]>('navigate');
  const [undoStack, setUndoStack] = useState<HoleLayoutGeometry[]>([]);
  const [center, setCenter] = useState<GeoPoint>(resolveInitialCenter(geometry));
  const [zoom, setZoom] = useState(16);
  const [mapSize, setMapSize] = useState({ width: 1, height: 1 });

  const axis = useMemo(() => resolveHoleAxis(geometry), [geometry]);

  useEffect(() => {
    if (geometry.teePoint) {
      setCenter(geometry.teePoint);
      return;
    }

    const fallbackCenter = resolveInitialCenter(geometry);
    if (fallbackCenter !== DEFAULT_CENTER) {
      setCenter(fallbackCenter);
      return;
    }

    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((position: { coords: { latitude: number; longitude: number } }) => setCenter({ lat: position.coords.latitude, lng: position.coords.longitude }))
      .catch(() => setCenter(DEFAULT_CENTER));
  }, [geometry]);

  const pushUndo = () => setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(geometry))]);

  const projectTouchToGeo = (x: number, y: number): GeoPoint => {
    const lngPerPixel = 360 / (256 * Math.pow(2, zoom));
    const latPerPixel = lngPerPixel;

    return {
      lng: center.lng + (x - mapSize.width / 2) * lngPerPixel,
      lat: center.lat - (y - mapSize.height / 2) * latPerPixel
    };
  };

  const onStrokeComplete = (points: GeoPoint[]) => {
    if (activeLayer === 'tee') {
      pushUndo();
      onChange({ ...geometry, teePoint: points[0] ?? null });
      return;
    }

    const polygon = convertStrokeToPolygon(points);
    if (polygon.length < 3) return;

    pushUndo();
    onChange(applyPolygonToLayer(geometry, activeLayer, polygon));
  };

  return (
    <View style={styles.wrap}>
      <HoleLayoutToolbar
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
        onUndo={() => {
          const latest = undoStack[undoStack.length - 1];
          if (!latest) return;
          onChange(latest);
          setUndoStack((prev) => prev.slice(0, -1));
        }}
        canUndo={undoStack.length > 0}
        onClearLayer={() => {
          pushUndo();
          onChange(clearLayer(geometry, activeLayer));
        }}
        onSave={() => onSave?.()}
      />

      <View style={styles.modeRow}>
        <Pressable style={[styles.modeBtn, mode === 'navigate' && styles.modeActive]} onPress={() => setMode('navigate')}><Text>Navigate</Text></Pressable>
        <Pressable style={[styles.modeBtn, mode === 'draw' && styles.modeActive]} onPress={() => setMode('draw')}><Text>Draw</Text></Pressable>
      </View>

      {!hasRequiredLayout(geometry) ? <Text style={styles.warning}>TEE and GREEN are required. Status: {resolveLayoutMappingStatus(geometry)}</Text> : null}
      {axis ? <Text style={styles.info}>Bearing {axis.bearing.toFixed(1)}° • Length {Math.round(axis.lengthMeters)} m</Text> : null}

      <View
        style={styles.mapWrap}
        onLayout={(event) => setMapSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      >
        {!MapLibre ? (
          <View style={styles.missingWrap}><Text style={styles.warning}>MapLibre native module missing in this build. Use an Expo dev build with MapLibre + Skia.</Text></View>
        ) : (
          <>
            <MapLibre.MapView
              style={StyleSheet.absoluteFill}
              logoEnabled={false}
              compassEnabled
              scrollEnabled={mode === 'navigate'}
              zoomEnabled={mode === 'navigate'}
              rotateEnabled={mode === 'navigate'}
              styleURL="https://demotiles.maplibre.org/style.json"
              onRegionDidChange={(event: any) => {
                const [lng, lat] = event.geometry?.coordinates ?? [center.lng, center.lat];
                setCenter({ lat, lng });
                setZoom(event.properties?.zoomLevel ?? zoom);
              }}
            >
              <MapLibre.Camera
                centerCoordinate={[center.lng, center.lat]}
                zoomLevel={zoom}
                heading={axis ? axis.bearing : 0}
                animationDuration={300}
              />
              <MapLibre.ShapeSource id="hole-layout-shapes" shape={toFeatureCollection(geometry)}>
                <MapLibre.FillLayer id="hole-layout-fill" style={{ fillColor: ['get', 'color'] }} />
              </MapLibre.ShapeSource>
            </MapLibre.MapView>
            <HoleMapCanvasOverlay enabled={mode === 'draw'} onStrokeComplete={onStrokeComplete} projectTouchToGeo={projectTouchToGeo} />
          </>
        )}
      </View>

      <Text style={styles.status}>Layout status: {resolveLayoutMappingStatus(geometry)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, alignItems: 'center', paddingVertical: 8 },
  modeActive: { backgroundColor: '#d1fae5', borderColor: '#0f766e' },
  mapWrap: { height: 320, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  missingWrap: { flex: 1, justifyContent: 'center', padding: 12 },
  warning: { color: '#b45309', fontWeight: '600' },
  info: { color: '#334155', fontSize: 12 },
  status: { color: '#475569', fontSize: 12, fontWeight: '700' }
});
