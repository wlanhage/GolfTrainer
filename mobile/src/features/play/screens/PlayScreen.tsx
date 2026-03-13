import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { AddCourseButton } from '../components/AddCourseButton';
import { CourseList } from '../components/CourseList';
import { CourseSearchInput } from '../components/CourseSearchInput';
import { InProgressRoundList } from '../components/InProgressRoundList';
import { playStorage } from '../storage/playStorage';
import { Course, InProgressRoundSummary } from '../types/play';

type Props = NativeStackScreenProps<AppStackParamList, 'Play'>;

export function PlayScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [inProgressRounds, setInProgressRounds] = useState<InProgressRoundSummary[]>([]);

  const refresh = useCallback(() => {
    playStorage.listCourses(search).then(setCourses).catch(() => Alert.alert('Kunde inte läsa lokala banor.'));
    playStorage.listInProgressRounds().then(setInProgressRounds).catch(() => undefined);
  }, [search]);

  useEffect(() => {
    playStorage.ensureSeedData().then(refresh).catch(refresh);
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startRound = async (course: Course) => {
    try {
      await playStorage.createHolesForCourse(course.id, course.holeCount);
      const round = await playStorage.startRound(course.id);
      navigation.navigate('RoundHole', { roundId: round.id, holeNumber: 1 });
    } catch (error) {
      Alert.alert('Kunde inte starta runda', (error as Error).message);
    }
  };

  const continueRound = (round: InProgressRoundSummary) => {
    navigation.navigate('RoundHole', { roundId: round.roundId, holeNumber: round.currentHoleNumber });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Spela</Text>
      <Text style={styles.subtitle}>Välj bana eller lägg till en ny direkt från flödet.</Text>
      <InProgressRoundList rounds={inProgressRounds} onContinueRound={continueRound} />
      <CourseSearchInput value={search} onChangeText={setSearch} />
      <AddCourseButton onPress={() => navigation.navigate('AddCourse')} />
      <View style={styles.listWrap}>
        <CourseList courses={courses} onSelectCourse={startRound} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: '#f1f5f9', flexGrow: 1 },
  title: { fontSize: 30, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#334155' },
  listWrap: { marginTop: 4 }
});
