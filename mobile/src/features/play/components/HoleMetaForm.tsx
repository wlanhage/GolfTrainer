import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  par: string;
  length: string;
  hcpIndex: string;
  onChange: (field: 'par' | 'length' | 'hcpIndex', value: string) => void;
  onSave: () => void;
};

export function HoleMetaForm({ par, length, hcpIndex, onChange, onSave }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Hålmetadata (valfritt under rundan)</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} keyboardType="number-pad" placeholder="Par" value={par} onChangeText={(value) => onChange('par', value)} />
        <TextInput style={styles.input} keyboardType="number-pad" placeholder="Längd" value={length} onChangeText={(value) => onChange('length', value)} />
        <TextInput style={styles.input} keyboardType="number-pad" placeholder="HCP" value={hcpIndex} onChangeText={(value) => onChange('hcpIndex', value)} />
      </View>
      <Pressable style={styles.button} onPress={onSave}>
        <Text style={styles.buttonText}>Spara metadata</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontSize: 14, color: '#334155', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff'
  },
  button: { alignSelf: 'flex-start', backgroundColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { fontWeight: '700', color: '#1e293b' }
});
