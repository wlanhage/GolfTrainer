import { ReactNode } from 'react';

export type Layer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';
export type Tool = 'pan' | Layer;

export type LayerDef = {
  key: Layer;
  label: string;
  color: string;
  kind: 'point' | 'polygon';
  hint: string;
};

export const LAYERS: LayerDef[] = [
  { key: 'tee', label: 'Tee', color: '#ef4444', kind: 'point', hint: 'Klicka på kartan för att placera tee.' },
  { key: 'green', label: 'Green', color: '#22c55e', kind: 'polygon', hint: 'Rita greenens kontur. Enter eller dubbelklick slutför.' },
  { key: 'fairway', label: 'Fairway', color: '#16a34a', kind: 'polygon', hint: 'Rita fairway (max 3 st per hål).' },
  { key: 'bunker', label: 'Bunker', color: '#f59e0b', kind: 'polygon', hint: 'Rita en bunker. Lägg till flera vid behov.' },
  { key: 'trees', label: 'Träd', color: '#15803d', kind: 'polygon', hint: 'Rita ett trädområde.' },
  { key: 'ob', label: 'OB', color: '#dc2626', kind: 'polygon', hint: 'Rita out-of-bounds-område.' }
];

export const LAYER_BY_KEY = LAYERS.reduce((acc, def) => {
  acc[def.key] = def;
  return acc;
}, {} as Record<Layer, LayerDef>);

export function LayerGlyph({ layer, size = 16 }: { layer: Layer; size?: number }): ReactNode {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
  switch (layer) {
    case 'tee':
      return (
        <svg {...props} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 22V3" />
          <path d="M7 4l9 3-9 3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'green':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" fill="currentColor" />
        </svg>
      );
    case 'fairway':
      return (
        <svg {...props} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="M9 21c0-6 0-9 1.5-13S14 3 14 3" />
          <path d="M15 21c0-5 0-7 1-10" opacity={0.5} />
        </svg>
      );
    case 'bunker':
      return (
        <svg {...props}>
          <path d="M4 16c2-1 3 1 5 0s3-2 5-1 4 2 6 1v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="currentColor" />
          <circle cx="9" cy="9" r="1.5" fill="currentColor" />
          <circle cx="15" cy="7" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'trees':
      return (
        <svg {...props} fill="currentColor">
          <path d="M12 2l5 7h-3l4 6h-4v5h-4v-5H6l4-6H7z" />
        </svg>
      );
    case 'ob':
      return (
        <svg {...props} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 2 20h20z" fill="currentColor" stroke="none" opacity={0.85} />
          <path d="M12 9v5" stroke="#fff" />
          <circle cx="12" cy="17" r="0.6" fill="#fff" stroke="#fff" />
        </svg>
      );
  }
}

export function PanGlyph({ size = 16 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9V5.5a1.5 1.5 0 0 1 3 0V9m0 0V4a1.5 1.5 0 0 1 3 0v5m0 0V5a1.5 1.5 0 0 1 3 0v6m0-2.5a1.5 1.5 0 0 1 3 0V14c0 3.5-2 6-6 6h-1.5c-2 0-3-1-4.5-3l-2.2-3.2a1.5 1.5 0 0 1 2.3-1.8L8 13" />
    </svg>
  );
}
