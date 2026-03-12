export type CaddyClub = {
  id: string;
  name: string;
};

export type CaddyShotInput = {
  distanceMeters: string;
  lateralOffsetMeters: string;
  peakHeightMeters: string;
  spinRpm: string;
};

export type CaddyShot = {
  id: string;
  clubKey: string;
  distanceMeters: number;
  lateralOffsetMeters: number;
  peakHeightMeters?: number;
  spinRpm?: number;
  recordedAt: string;
};

export type CaddyClubSummary = {
  clubKey: string;
  clubLabel: string;
  sampleCount: number;
  trimmedSampleCount: number;
  trimPercentEachSide: number;
  distanceMeters?: number;
  dispersionMeters?: number;
  peakHeightMeters?: number;
  spinRpm?: number;
};

export const emptyShotInput = (): CaddyShotInput => ({
  distanceMeters: '',
  lateralOffsetMeters: '',
  peakHeightMeters: '',
  spinRpm: ''
});
