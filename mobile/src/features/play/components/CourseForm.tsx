import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  clubName: string;
  courseName: string;
  teeName: string;
  holeCount: 9 | 18;
  submitLabel: string;
  onChange: (field: 'clubName' | 'courseName' | 'teeName' | 'holeCount', value: string | (9 | 18)) => void;
  onSubmit: () => void;
};

export function CourseForm({ clubName, courseName, teeName, holeCount, submitLabel, onChange, onSubmit }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput style={styles.input} placeholder="Golfklubb" value={clubName} onChangeText={(value) => onChange('clubName', value)} />
      <TextInput style={styles.input} placeholder="Bana/slinga" value={courseName} onChangeText={(value) => onChange('courseName', value)} />
      <TextInput style={styles.input} placeholder="Tee-färg (valfritt)" value={teeName} onChangeText={(value) => onChange('teeName', value)} />

      <View style={styles.row}>
        {[9, 18].map((value) => (
          <Pressable key={value} style={[styles.choice, holeCount === value && styles.choiceSelected]} onPress={() => onChange('holeCount', value as 9 | 18)}>
            <Text style={holeCount === value ? styles.choiceSelectedText : styles.choiceText}>{value} hål</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={onSubmit}>
        <Text style={styles.primaryButtonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  choice: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#94a3b8', paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  choiceSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  choiceText: { color: '#0f172a', fontWeight: '600' },
  choiceSelectedText: { color: '#fff', fontWeight: '700' },
  primaryButton: { marginTop: 16, borderRadius: 12, backgroundColor: '#0f766e', paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' }
});
