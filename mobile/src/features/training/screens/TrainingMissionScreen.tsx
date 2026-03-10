import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { Leaderboard } from '../components/Leaderboard';
import { getTrainingMissionById } from '../data/trainingMissions';
import { LeaderboardFilter } from '../types/training';

type Props = NativeStackScreenProps<AppStackParamList, 'TrainingMission'>;

export function TrainingMissionScreen({ route }: Props) {
  const mission = getTrainingMissionById(route.params.missionId);
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const [stepperScore, setStepperScore] = useState(mission?.defaultScore ?? 0);
  const [manualScore, setManualScore] = useState(String(mission?.defaultScore ?? ''));

  const filteredEntries = useMemo(() => {
    if (!mission) {
      return [];
    }

    if (filter === 'friends') {
      return mission.leaderboard.filter((entry) => entry.isFriend);
    }

    if (filter === 'mine') {
      return mission.leaderboard.filter((entry) => entry.isCurrentUser);
    }

    return mission.leaderboard;
  }, [filter, mission]);

  if (!mission) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.missingTitle}>Mission saknas</Text>
        <Text style={styles.missingText}>Kunde inte hitta vald träningsmission.</Text>
      </View>
    );
  }

  const saveScore = () => {
    const finalScore = mission.scoreInputType === 'manual' ? Number(manualScore) || 0 : stepperScore;
    Alert.alert('Resultat sparat', `Ditt resultat (${finalScore}) är registrerat för ${mission.title}.`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{mission.symbol} {mission.title}</Text>
      <Text style={styles.description}>{mission.description}</Text>
      <Text style={styles.objective}>{mission.objective}</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>{mission.scoreLabel}</Text>

        {mission.scoreInputType === 'manual' ? (
          <TextInput
            style={styles.manualInput}
            value={manualScore}
            keyboardType="numeric"
            onChangeText={setManualScore}
            placeholder="Skriv in poäng"
            placeholderTextColor="#9ca3af"
          />
        ) : (
          <View style={styles.stepperWrap}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setStepperScore((prev) => Math.max(0, prev - 1))}
            >
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <View style={styles.stepperValueBox}>
              <Text style={styles.stepperValue}>{stepperScore}</Text>
            </View>
            <Pressable style={styles.stepperButton} onPress={() => setStepperScore((prev) => prev + 1)}>
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
        )}

        <Pressable style={styles.saveButton} onPress={saveScore}>
          <Text style={styles.saveButtonText}>Spara resultat</Text>
        </Pressable>
      </View>

      <Leaderboard entries={filteredEntries} activeFilter={filter} onChangeFilter={setFilter} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
    gap: 12
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827'
  },
  description: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22
  },
  objective: {
    fontSize: 15,
    color: '#0f766e',
    fontWeight: '600'
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 14
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  manualInput: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#d1d5db',
    paddingVertical: 26,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#f9fafb'
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  stepperButton: {
    width: 84,
    height: 84,
    borderRadius: 16,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepperText: {
    fontSize: 42,
    color: '#ffffff',
    fontWeight: '700'
  },
  stepperValueBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb'
  },
  stepperValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#111827'
  },
  saveButton: {
    backgroundColor: '#15803d',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20
  },
  missingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827'
  },
  missingText: {
    marginTop: 4,
    color: '#4b5563'
  }
});
