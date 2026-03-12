export const CADDY_RESULT_TAG = 'CADDY_CLUB';

export const CADDY_CLUBS = [
  { key: 'driver', label: 'Driver' },
  { key: 'fairway-7', label: 'Fairway 7' },
  { key: 'fairway-5', label: 'Fairway 5' },
  { key: 'fairway-3', label: 'Fairway 3' },
  { key: 'hybrid-5', label: 'Hybrid 5' },
  { key: 'hybrid-4', label: 'Hybrid 4' },
  { key: 'hybrid-3', label: 'Hybrid 3' },
  { key: 'iron-3', label: 'Järn 3' },
  { key: 'iron-4', label: 'Järn 4' },
  { key: 'iron-5', label: 'Järn 5' },
  { key: 'iron-6', label: 'Järn 6' },
  { key: 'iron-7', label: 'Järn 7' },
  { key: 'iron-8', label: 'Järn 8' },
  { key: 'iron-9', label: 'Järn 9' },
  { key: 'pitch', label: 'Pitch' },
  { key: 'gap-wedge', label: 'Gap wedge' },
  { key: 'sand-wedge', label: 'Sand wedge' },
  { key: 'lob-wedge', label: 'Lob wedge' }
] as const;

export type CaddyClubKey = (typeof CADDY_CLUBS)[number]['key'];

export const CADDY_CLUB_KEY_SET = new Set<string>(CADDY_CLUBS.map((club) => club.key));
