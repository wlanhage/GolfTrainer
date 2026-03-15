import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import { GeoPoint } from '../types/play';

type Props = {
  enabled: boolean;
  onStrokeComplete: (points: GeoPoint[]) => void;
  projectTouchToGeo: (x: number, y: number) => GeoPoint;
};

export function HoleMapCanvasOverlay({ enabled, onStrokeComplete, projectTouchToGeo }: Props) {
  const [stroke, setStroke] = useState<{ x: number; y: number }[]>([]);

  const path = useMemo(() => {
    const drawPath = Skia.Path.Make();
    if (stroke.length === 0) return drawPath;
    drawPath.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i += 1) {
      drawPath.lineTo(stroke[i].x, stroke[i].y);
    }
    return drawPath;
  }, [stroke]);

  const onGrant = (event: GestureResponderEvent) => {
    if (!enabled) return;
    const { locationX, locationY } = event.nativeEvent;
    setStroke([{ x: locationX, y: locationY }]);
  };

  const onMove = (event: GestureResponderEvent) => {
    if (!enabled) return;
    const { locationX, locationY } = event.nativeEvent;
    setStroke((prev) => [...prev, { x: locationX, y: locationY }]);
  };

  const onRelease = () => {
    if (!enabled || stroke.length === 0) return;
    onStrokeComplete(stroke.map((point) => projectTouchToGeo(point.x, point.y)));
    setStroke([]);
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={enabled ? 'auto' : 'none'}
      onStartShouldSetResponder={() => enabled}
      onMoveShouldSetResponder={() => enabled}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
    >
      <Canvas style={styles.canvas}>
        <Path path={path} style="stroke" color="rgba(15,118,110,0.9)" strokeWidth={10} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 }
});
