import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RoundOverviewItem } from '../types/play';

type Props = {
  item: RoundOverviewItem;
  onPress: () => void;
};

export function RoundOverviewCard({ item, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View>
        <Text style={styles.title}>Hål {item.holeNumber}</Text>
        <Text style={styles.meta}>Par {item.par ?? '-'} • Längd {item.length ?? '-'} • HCP {item.hcpIndex ?? '-'}</Text>
      </View>
      <Text style={styles.score}>{item.strokes ?? '-'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', color: '#0f172a' },
  meta: { color: '#64748b', fontSize: 12 },
  score: { fontSize: 26, fontWeight: '700', color: '#0f766e' }
});
