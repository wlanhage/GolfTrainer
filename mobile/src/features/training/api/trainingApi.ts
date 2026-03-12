import { useMemo } from 'react';
import { ApiClient } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/authStore';
import { TrainingMission } from '../types/training';

type MissionResponse = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  objective: string;
  scoreLabel: string;
  scoreInputType: 'STEPPER' | 'MANUAL_NUMBER';
  stepperMin: number | null;
  stepperMax: number | null;
  defaultScore: number | null;
  leaderboardEntries: Array<{
    id: string;
    playerName: string;
    score: number;
    userId: string;
  }>;
};

const mapMission = (mission: MissionResponse): TrainingMission => ({
  id: mission.id,
  title: mission.name,
  symbol: mission.icon,
  description: mission.description,
  objective: mission.objective,
  scoreLabel: mission.scoreLabel,
  scoreInputType: mission.scoreInputType === 'MANUAL_NUMBER' ? 'manual' : 'stepper',
  defaultScore: mission.defaultScore ?? 0,
  stepperMin: mission.stepperMin ?? 0,
  stepperMax: mission.stepperMax ?? 10,
  leaderboard: mission.leaderboardEntries.map((entry) => ({
    id: entry.id,
    playerName: entry.playerName,
    score: entry.score
  }))
});

export function useTrainingApi() {
  const { getValidAccessToken, refreshSession } = useAuth();

  const client = useMemo(
    () =>
      new ApiClient({
        getAccessToken: getValidAccessToken,
        onUnauthorized: refreshSession
      }),
    [getValidAccessToken, refreshSession]
  );

  return useMemo(
    () => ({
      listMissions: async () => {
        const missions = await client.request<MissionResponse[]>('/missions');
        return missions.map(mapMission);
      },
      getMissionById: async (missionId: string) => {
        const mission = await client.request<MissionResponse>(`/missions/${missionId}`);
        return mapMission(mission);
      }
    }),
    [client]
  );
}
