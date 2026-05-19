// Centrala färger för layout-element på kartan. Används av HolePlayMap,
// HoleLayoutEditor och eventuella andra kartrenderingar. Ändra här → ändras
// överallt. Suffixet är alpha (RGBA hex).

export const HOLE_COLORS = {
  green: '#22c55e88',
  fairway: '#16a34a66',
  bunker: '#eab30888',
  trees: '#15803d77',
  ob: '#dc262688',
  tee: '#ef4444',
  player: '#0ea5e9',
  draft: '#0f766e'
} as const;
