import { Pressable, StyleSheet, Text } from 'react-native';

type Props = { onPress: () => void };

export function AddCourseButton({ onPress }: Props) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>+ Lägg till bana</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0f766e'
  },
  text: { color: '#ffffff', fontWeight: '700', fontSize: 16 }
});
