declare module '@maplibre/maplibre-react-native' {
  import { ComponentType } from 'react';
  export const MapView: ComponentType<any>;
  export const Camera: ComponentType<any>;
  export const ShapeSource: ComponentType<any>;
  export const FillLayer: ComponentType<any>;
  const defaultExport: {
    MapView: ComponentType<any>;
    Camera: ComponentType<any>;
    ShapeSource: ComponentType<any>;
    FillLayer: ComponentType<any>;
  };
  export default defaultExport;
}

declare module '@shopify/react-native-skia' {
  import { ComponentType } from 'react';
  export const Canvas: ComponentType<any>;
  export const Path: ComponentType<any>;
  export const Skia: any;
}

declare module 'expo-location' {
  export const Accuracy: { Balanced: number };
  export function getCurrentPositionAsync(options?: any): Promise<{ coords: { latitude: number; longitude: number } }>;
}
