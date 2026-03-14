import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { CourseSearchInput } from '../../play/components/CourseSearchInput';
import { playStorage } from '../../play/storage/playStorage';
import { Course } from '../../play/types/play';

type Props = NativeStackScreenProps<AppStackParamList, 'AdminCourses'>;

export function AdminCoursesScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);

  const loadCourses = useCallback(() => {
    playStorage.listCourses(search).then(setCourses);
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      loadCourses();
    }, [loadCourses])
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin · Banor</Text>
      <CourseSearchInput value={search} onChangeText={setSearch} />
      <Pressable style={styles.refreshButton} onPress={loadCourses}>
        <Text style={styles.refreshText}>Uppdatera lista</Text>
      </Pressable>

      <View style={styles.list}>
        {courses.map((course) => (
          <Pressable key={course.id} style={styles.card} onPress={() => navigation.navigate('AdminCourseDetails', { courseId: course.id })}>
            <Text style={styles.courseTitle}>{course.courseName}</Text>
            <Text style={styles.meta}>{course.clubName}</Text>
            <Text style={styles.meta}>{course.holeCount} hål • {course.teeName ?? 'Ingen tee'}</Text>
            <Text style={styles.subtle}>Senast uppdaterad: {new Date(course.updatedAt).toLocaleString()}</Text>
            <Text style={styles.subtle}>source: {course.source} • localOnly: {course.localOnly ? 'ja' : 'nej'} • sync: {course.syncStatus}</Text>
          </Pressable>
        ))}
        {courses.length === 0 ? <Text style={styles.empty}>Inga banor hittades.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: '#f1f5f9' },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  refreshButton: { alignSelf: 'flex-start', backgroundColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  refreshText: { color: '#1e293b', fontWeight: '700' },
  list: { gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', padding: 12, gap: 4 },
  courseTitle: { fontWeight: '800', color: '#0f172a', fontSize: 18 },
  meta: { color: '#334155', fontWeight: '600' },
  subtle: { color: '#64748b', fontSize: 12 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 }
});
