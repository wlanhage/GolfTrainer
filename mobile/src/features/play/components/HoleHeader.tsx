import { StyleSheet, Text, View } from 'react-native';

type Props = {
  holeNumber: number;
  par: number | null;
  length: number | null;
  hcpIndex: number | null;
};

export function HoleHeader({ holeNumber, par, length, hcpIndex }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Hål {holeNumber}</Text>
      <Text style={styles.meta}>Par: {par ?? '-'} • Längd: {length ?? '-'} • HCP: {hcpIndex ?? '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 14, color: '#334155' }
});
