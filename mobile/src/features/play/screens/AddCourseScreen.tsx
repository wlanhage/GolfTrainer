import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { playStorage } from '../storage/playStorage';
import { validateCourseInput } from '../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'AddCourse'>;

export function AddCourseScreen({ navigation }: Props) {
  const [clubName, setClubName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [teeName, setTeeName] = useState('');
  const [holeCount, setHoleCount] = useState<9 | 18>(9);

  const onCreate = async () => {
    const input = { clubName, courseName, teeName, holeCount };
    const error = validateCourseInput(input);
    if (error) return Alert.alert('Validering', error);

    try {
      const course = await playStorage.createCourse(input);
      await playStorage.createHolesForCourse(course.id, course.holeCount);
      navigation.navigate('CourseScorecardSetup', { courseId: course.id });
    } catch (createError) {
      Alert.alert('Kunde inte skapa bana', (createError as Error).message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ny bana</Text>
      <TextInput style={styles.input} placeholder="Golfklubb" value={clubName} onChangeText={setClubName} />
      <TextInput style={styles.input} placeholder="Bana/slinga" value={courseName} onChangeText={setCourseName} />
      <TextInput style={styles.input} placeholder="Tee-färg (valfritt)" value={teeName} onChangeText={setTeeName} />

      <View style={styles.row}>
        {[9, 18].map((value) => (
          <Pressable key={value} style={[styles.choice, holeCount === value && styles.choiceSelected]} onPress={() => setHoleCount(value as 9 | 18)}>
            <Text style={holeCount === value ? styles.choiceSelectedText : styles.choiceText}>{value} hål</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={onCreate}>
        <Text style={styles.primaryButtonText}>Starta runda och bygg bana</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, backgroundColor: '#f1f5f9', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  choice: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#94a3b8', paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  choiceSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  choiceText: { color: '#0f172a', fontWeight: '600' },
  choiceSelectedText: { color: '#fff', fontWeight: '700' },
  primaryButton: { marginTop: 16, borderRadius: 12, backgroundColor: '#0f766e', paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' }
});
