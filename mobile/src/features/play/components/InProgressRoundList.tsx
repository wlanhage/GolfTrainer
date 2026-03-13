import { Pressable, StyleSheet, Text, View } from 'react-native';
import { InProgressRoundSummary } from '../types/play';

type Props = {
  rounds: InProgressRoundSummary[];
  onContinueRound: (round: InProgressRoundSummary) => void;
};

export function InProgressRoundList({ rounds, onContinueRound }: Props) {
  if (rounds.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Pågående rundor</Text>
      {rounds.map((round) => (
        <View key={round.roundId} style={styles.card}>
          <View style={styles.info}>
            <Text style={styles.title}>{round.courseName}</Text>
            <Text style={styles.meta}>{round.clubName} • Hål {round.currentHoleNumber}</Text>
          </View>
          <Pressable style={styles.button} onPress={() => onContinueRound(round)}>
            <Text style={styles.buttonText}>Fortsätt</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  heading: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  card: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  info: { flex: 1 },
  title: { fontWeight: '700', color: '#0f172a' },
  meta: { color: '#334155', marginTop: 2 },
  button: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  buttonText: { color: '#fff', fontWeight: '700' }
});
