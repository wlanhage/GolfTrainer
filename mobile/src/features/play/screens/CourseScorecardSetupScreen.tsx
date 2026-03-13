import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { ScorecardBulkEditor } from '../components/ScorecardBulkEditor';
import { playStorage } from '../storage/playStorage';
import { ScorecardSetupMode } from '../types/play';
import { parseOptionalHcpIndex, parseOptionalPositiveNumber } from '../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'CourseScorecardSetup'>;

type LocalRow = { holeNumber: number; par: string; length: string; hcpIndex: string; holeId: string };

export function CourseScorecardSetupScreen({ route, navigation }: Props) {
  const { courseId } = route.params;
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [mode, setMode] = useState<ScorecardSetupMode>('skip');

  useEffect(() => {
    playStorage.getCourseWithHoles(courseId).then((result) => {
      if (!result) return;
      setRows(result.holes.map((hole) => ({ holeNumber: hole.holeNumber, par: '', length: '', hcpIndex: '', holeId: hole.id })));
    });
  }, [courseId]);

  const onChangeRow = (holeNumber: number, field: 'par' | 'length' | 'hcpIndex', value: string) => {
    setRows((current) => current.map((row) => (row.holeNumber === holeNumber ? { ...row, [field]: value } : row)));
  };

  const startRoundFlow = async () => {
    const round = await playStorage.startRound(courseId);
    navigation.replace('RoundHole', { roundId: round.id, holeNumber: 1 });
  };

  const onSaveBulkAndStart = async () => {
    try {
      for (const row of rows) {
        await playStorage.updateHoleMeta(row.holeId, {
          par: parseOptionalPositiveNumber(row.par),
          length: parseOptionalPositiveNumber(row.length),
          hcpIndex: parseOptionalHcpIndex(row.hcpIndex)
        });
      }
      await startRoundFlow();
    } catch (error) {
      Alert.alert('Kunde inte spara scorekort', (error as Error).message);
    }
  };

  const onSelectMode = async (nextMode: ScorecardSetupMode) => {
    setMode(nextMode);
    if (nextMode === 'bulk_now') return;
    await startRoundFlow();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Hur vill du lägga till scorekortet?</Text>
      <View style={styles.modeList}>
        <Pressable style={[styles.modeCard, mode === 'bulk_now' && styles.modeCardSelected]} onPress={() => onSelectMode('bulk_now')}>
          <Text style={styles.modeText}>1. Lägg till scorekort nu</Text>
        </Pressable>
        <Pressable style={styles.modeCard} onPress={() => onSelectMode('per_hole')}>
          <Text style={styles.modeText}>2. Lägg till vid varje tee</Text>
        </Pressable>
        <Pressable style={styles.modeCard} onPress={() => onSelectMode('skip')}>
          <Text style={styles.modeText}>3. Hoppa över tills vidare</Text>
        </Pressable>
      </View>

      {mode === 'bulk_now' ? <ScorecardBulkEditor rows={rows} onChangeRow={onChangeRow} onSave={onSaveBulkAndStart} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#f1f5f9' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  modeList: { gap: 8 },
  modeCard: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, backgroundColor: '#fff', padding: 12 },
  modeCardSelected: { borderColor: '#0f766e', backgroundColor: '#ecfeff' },
  modeText: { fontWeight: '600', color: '#1f2937' }
});
