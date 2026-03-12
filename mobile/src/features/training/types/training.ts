export type ScoreInputType = 'stepper' | 'manual';

export type LeaderboardFilter = 'all' | 'friends' | 'mine';

export type LeaderboardEntry = {
  id: string;
  playerName: string;
  score: number;
  isFriend?: boolean;
  isCurrentUser?: boolean;
};

export type TrainingMission = {
  id: string;
  title: string;
  symbol: string;
  description: string;
  objective: string;
  scoreLabel: string;
  scoreInputType: ScoreInputType;
  defaultScore?: number;
  stepperMin?: number;
  stepperMax?: number;
  leaderboard: LeaderboardEntry[];
};
