// Spelformer för rundor — JSON-driven config så vi kan flytta till DB senare
// utan att röra UI/scoring-logiken.

export type RoundFormatKey =
  | 'STROKE_PLAY'
  | 'STABLEFORD'
  | 'BEST_BALL_TEAM'
  | 'BEST_BALL_2V2'
  | 'FFA_STROKE'
  | 'FFA_STABLEFORD'
  | 'WOLF';

export type PlayFormat = {
  key: RoundFormatKey;
  name: string;
  icon: string;
  description: string;
  mode: 'solo' | 'group';
  minPlayers: number;
  maxPlayers: number;
  teams: 0 | 1 | 2; // 0 = ingen lag-modell, 1 = ett lag, 2 = två lag
  scoring: 'strokes' | 'stableford' | 'best-ball' | 'wolf';
};

export const PLAY_FORMATS: PlayFormat[] = [
  {
    key: 'STROKE_PLAY',
    name: 'Slagspel',
    icon: '🏌️',
    description: 'Räkna slag. Färre slag är bättre. Klassiker när du tränar och vill se din totala score mot par.',
    mode: 'solo',
    minPlayers: 1,
    maxPlayers: 1,
    teams: 0,
    scoring: 'strokes'
  },
  {
    key: 'STABLEFORD',
    name: 'Poängbogey',
    icon: '🎯',
    description:
      'Poäng per hål: birdie=3, par=2, bogey=1, dubbelbogey eller sämre=0, eagle eller bättre=4. Fler poäng är bättre. Du ser både slag och poäng i vyn.',
    mode: 'solo',
    minPlayers: 1,
    maxPlayers: 1,
    teams: 0,
    scoring: 'stableford'
  },
  {
    key: 'BEST_BALL_TEAM',
    name: 'Bästboll (1 lag)',
    icon: '👥',
    description:
      'Alla i samma lag. Per hål räknas lagets BÄSTA score (lägsta antal slag). Summan över rundan avgör.',
    mode: 'group',
    minPlayers: 2,
    maxPlayers: 4,
    teams: 1,
    scoring: 'best-ball'
  },
  {
    key: 'BEST_BALL_2V2',
    name: 'Bästboll 2 vs 2',
    icon: '⚔️',
    description:
      'Två lag om två. Per hål räknas varje lags bästa score. Det lag som har lägst summa över rundan vinner.',
    mode: 'group',
    minPlayers: 4,
    maxPlayers: 4,
    teams: 2,
    scoring: 'best-ball'
  },
  {
    key: 'FFA_STROKE',
    name: 'Alla mot alla (slag)',
    icon: '🥊',
    description: 'Varje spelare för sig. Lägsta totala antal slag vinner.',
    mode: 'group',
    minPlayers: 2,
    maxPlayers: 8,
    teams: 0,
    scoring: 'strokes'
  },
  {
    key: 'FFA_STABLEFORD',
    name: 'Alla mot alla (poäng)',
    icon: '🏆',
    description:
      'Varje spelare för sig, men räknat i poängbogey. Birdie=3, par=2, bogey=1. Flest poäng vinner.',
    mode: 'group',
    minPlayers: 2,
    maxPlayers: 8,
    teams: 0,
    scoring: 'stableford'
  },
  {
    key: 'WOLF',
    name: 'Wolf',
    icon: '🐺',
    description:
      'Fyra spelare. Per hål är en spelare "wolf" (roterar). Wolf väljer en partner att slå tillsammans med — eller går "lone wolf" själv. Vinner sitt lag hålet: wolf+partner = 2 poäng var, lone wolf = 4 poäng. Förlorar: motståndarna får 1 poäng var.',
    mode: 'group',
    minPlayers: 4,
    maxPlayers: 4,
    teams: 0, // dynamiska lag per hål
    scoring: 'wolf'
  }
];

export const SOLO_FORMATS = PLAY_FORMATS.filter((f) => f.mode === 'solo');
export const GROUP_FORMATS = PLAY_FORMATS.filter((f) => f.mode === 'group');

export const getFormat = (key: RoundFormatKey): PlayFormat => {
  const f = PLAY_FORMATS.find((x) => x.key === key);
  if (!f) throw new Error(`Unknown format: ${key}`);
  return f;
};
