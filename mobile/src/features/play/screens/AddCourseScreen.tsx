import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { CourseForm } from '../components/CourseForm';
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
      <CourseForm
        clubName={clubName}
        courseName={courseName}
        teeName={teeName}
        holeCount={holeCount}
        submitLabel="Starta runda och bygg bana"
        onChange={(field, value) => {
          if (field === 'clubName') setClubName(value as string);
          if (field === 'courseName') setCourseName(value as string);
          if (field === 'teeName') setTeeName(value as string);
          if (field === 'holeCount') setHoleCount(value as 9 | 18);
        }}
        onSubmit={onCreate}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, backgroundColor: '#f1f5f9', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '800' }
});
