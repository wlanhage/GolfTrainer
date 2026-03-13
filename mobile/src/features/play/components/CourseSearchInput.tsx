import { StyleSheet, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
};

export function CourseSearchInput({ value, onChangeText }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        placeholder="Sök bana eller klubb"
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  }
});
