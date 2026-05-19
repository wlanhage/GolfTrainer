import type { CaddyClub } from './types';

export const caddyClubs: CaddyClub[] = [
  { id: 'driver', name: 'Driver' },
  { id: 'fairway-3', name: 'Fairway 3' },
  { id: 'fairway-5', name: 'Fairway 5' },
  { id: 'fairway-7', name: 'Fairway 7' },
  { id: 'hybrid-3', name: 'Hybrid 3' },
  { id: 'hybrid-4', name: 'Hybrid 4' },
  { id: 'hybrid-5', name: 'Hybrid 5' },
  { id: 'iron-3', name: 'Järn 3' },
  { id: 'iron-4', name: 'Järn 4' },
  { id: 'iron-5', name: 'Järn 5' },
  { id: 'iron-6', name: 'Järn 6' },
  { id: 'iron-7', name: 'Järn 7' },
  { id: 'iron-8', name: 'Järn 8' },
  { id: 'iron-9', name: 'Järn 9' },
  { id: 'pitch', name: 'Pitch' },
  { id: 'gap-wedge', name: 'Gap wedge' },
  { id: 'sand-wedge', name: 'Sand wedge' },
  { id: 'lob-wedge', name: 'Lob wedge' }
];

export const getCaddyClubShortLabel = (clubId: string) => {
  if (clubId === 'driver') return 'D';
  if (clubId.startsWith('fairway-')) return `F${clubId.replace('fairway-', '')}`;
  if (clubId.startsWith('hybrid-')) return `H${clubId.replace('hybrid-', '')}`;
  if (clubId.startsWith('iron-')) return `J${clubId.replace('iron-', '')}`;
  if (clubId === 'pitch') return 'P';
  if (clubId === 'gap-wedge') return 'G';
  if (clubId === 'sand-wedge') return 'S';
  if (clubId === 'lob-wedge') return 'L';
  return clubId.slice(0, 1).toUpperCase();
};
