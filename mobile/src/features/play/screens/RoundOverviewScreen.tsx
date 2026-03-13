import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { RoundOverviewList } from '../components/RoundOverviewList';
import { playStorage } from '../storage/playStorage';
import { RoundOverview } from '../types/play';

type Props = NativeStackScreenProps<AppStackParamList, 'RoundOverview'>;

export function RoundOverviewScreen({ route, navigation }: Props) {
  const [overview, setOverview] = useState<RoundOverview | null>(null);

  useEffect(() => {
    playStorage.getRoundOverview(route.params.roundId).then(setOverview);
  }, [route.params.roundId]);

  if (!overview) {
    return <ScrollView contentContainerStyle={styles.container}><Text>Laddar översikt...</Text></ScrollView>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Rundöversikt</Text>
      <Text style={styles.summary}>
        Score: {overview.totalScore} • Par: {overview.totalPar} • Relativt par: {overview.relativeToPar === null ? '-' : overview.relativeToPar >= 0 ? `+${overview.relativeToPar}` : overview.relativeToPar}
      </Text>
      <Text style={styles.summary}>Registrerade hål: {overview.completedHoles}/{overview.items.length}</Text>

      <RoundOverviewList
        items={overview.items}
        onSelectHole={async (holeNumber) => {
          await playStorage.setCurrentHole(route.params.roundId, holeNumber);
          navigation.navigate('RoundHole', { roundId: route.params.roundId, holeNumber });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 8, backgroundColor: '#f1f5f9' },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  summary: { color: '#334155' }
});
