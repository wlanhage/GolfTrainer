import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Row = { holeNumber: number; par: string; length: string; hcpIndex: string };

type Props = {
  rows: Row[];
  onChangeRow: (holeNumber: number, field: 'par' | 'length' | 'hcpIndex', value: string) => void;
  onSave: () => void;
};

export function ScorecardBulkEditor({ rows, onChangeRow, onSave }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Fyll scorekort för alla hål</Text>
      <ScrollView style={styles.list}>
        {rows.map((row) => (
          <View key={row.holeNumber} style={styles.row}>
            <Text style={styles.holeNo}>Hål {row.holeNumber}</Text>
            <TextInput style={styles.input} value={row.par} onChangeText={(value) => onChangeRow(row.holeNumber, 'par', value)} placeholder="Par" keyboardType="number-pad" />
            <TextInput style={styles.input} value={row.length} onChangeText={(value) => onChangeRow(row.holeNumber, 'length', value)} placeholder="Längd" keyboardType="number-pad" />
            <TextInput style={styles.input} value={row.hcpIndex} onChangeText={(value) => onChangeRow(row.holeNumber, 'hcpIndex', value)} placeholder="HCP" keyboardType="number-pad" />
          </View>
        ))}
      </ScrollView>
      <Pressable style={styles.button} onPress={onSave}><Text style={styles.buttonText}>Spara scorekort</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  list: { maxHeight: 420 },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 },
  holeNo: { width: 56 },
  input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 8 },
  button: { backgroundColor: '#0f766e', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '700' }
});
