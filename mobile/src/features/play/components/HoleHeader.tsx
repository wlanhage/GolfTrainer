import { StyleSheet, Text, View } from 'react-native';
import { RoundHole } from '../types/play';

type Props = { roundHole: RoundHole };

export function HoleHeader({ roundHole }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Hål {roundHole.holeNumber}</Text>
      <Text style={styles.meta}>Par: {roundHole.parSnapshot ?? '-'} • Längd: {roundHole.lengthSnapshot ?? '-'} • HCP: {roundHole.hcpIndexSnapshot ?? '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#0f172a' },
  meta: { fontSize: 14, color: '#334155' }
});
