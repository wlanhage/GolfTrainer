import { StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function HoleScoreInput({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Resultat (slag)</Text>
      <TextInput
        keyboardType="number-pad"
        placeholder="Ex: 4"
        value={value}
        onChangeText={onChange}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  input: {
    fontSize: 26,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16
  }
});
