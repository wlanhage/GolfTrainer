import { View } from 'react-native';
import { GeoPoint } from '../types/play';

type Props = {
  enabled: boolean;
  onStrokeComplete: (points: GeoPoint[]) => void;
  projectTouchToGeo: (x: number, y: number) => GeoPoint;
};

/**
 * Web stub: Skia is not loaded on web to avoid React 19 / ReactCurrentOwner errors.
 * Canvas drawing for hole layout is only available in the native app.
 */
export function HoleMapCanvasOverlay(_props: Props) {
  return <View />;
}
