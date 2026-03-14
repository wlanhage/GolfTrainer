import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { CourseForm } from '../../play/components/CourseForm';
import { playStorage } from '../../play/storage/playStorage';
import { Course, Hole, HoleLayout } from '../../play/types/play';

type Props = NativeStackScreenProps<AppStackParamList, 'AdminCourseDetails'>;
type HoleWithLayout = Hole & { layout: HoleLayout | null };

export function AdminCourseDetailsScreen({ route, navigation }: Props) {
  const { courseId } = route.params;
  const [course, setCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<HoleWithLayout[]>([]);
  const [form, setForm] = useState({ clubName: '', courseName: '', teeName: '', holeCount: 9 as 9 | 18 });

  const load = useCallback(() => {
    playStorage.getCourseAdminDetails(courseId).then((result) => {
      if (!result) return;
      setCourse(result.course);
      setHoles(result.holes);
      setForm({
        clubName: result.course.clubName,
        courseName: result.course.courseName,
        teeName: result.course.teeName ?? '',
        holeCount: result.course.holeCount
      });
    });
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const missingHoleCount = useMemo(() => (course ? Math.max(course.holeCount - holes.length, 0) : 0), [course, holes.length]);

  if (!course) {
    return <View style={styles.center}><Text>Laddar bana...</Text></View>;
  }

  const onSaveCourse = async () => {
    try {
      await playStorage.updateCourse(courseId, form);
      await load();
      Alert.alert('Sparat', 'Banan är uppdaterad.');
    } catch (error) {
      Alert.alert('Kunde inte spara bana', (error as Error).message);
    }
  };

  const createMissingHoles = async () => {
    await playStorage.createHolesForCourse(course.id, course.holeCount);
    await load();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin · {course.courseName}</Text>
      <CourseForm
        clubName={form.clubName}
        courseName={form.courseName}
        teeName={form.teeName}
        holeCount={form.holeCount}
        submitLabel="Spara bana"
        onChange={(field, value) => {
          if (field === 'clubName') setForm((current) => ({ ...current, clubName: value as string }));
          if (field === 'courseName') setForm((current) => ({ ...current, courseName: value as string }));
          if (field === 'teeName') setForm((current) => ({ ...current, teeName: value as string }));
          if (field === 'holeCount') setForm((current) => ({ ...current, holeCount: value as 9 | 18 }));
        }}
        onSubmit={() => void onSaveCourse()}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hål ({holes.length}/{course.holeCount})</Text>
        {missingHoleCount > 0 ? (
          <Pressable style={styles.fixButton} onPress={() => void createMissingHoles()}>
            <Text style={styles.fixButtonText}>Skapa saknade hål ({missingHoleCount})</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.list}>
        {holes.map((hole) => {
          const metaComplete = hole.par !== null && hole.length !== null && hole.hcpIndex !== null;
          const layoutStatus = hole.layout?.mappingStatus ?? 'not_started';
          return (
            <Pressable
              key={hole.id}
              style={styles.holeCard}
              onPress={() => navigation.navigate('AdminHoleEdit', { courseId, holeNumber: hole.holeNumber })}
            >
              <Text style={styles.holeTitle}>Hål {hole.holeNumber}</Text>
              <Text style={styles.meta}>Metadata: {metaComplete ? 'komplett' : 'saknas/delvis'}</Text>
              <Text style={styles.meta}>Layout: {layoutStatus}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 14, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  sectionHeader: { gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  fixButton: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  fixButtonText: { color: '#166534', fontWeight: '700' },
  list: { gap: 10 },
  holeCard: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, backgroundColor: '#fff', padding: 12, gap: 2 },
  holeTitle: { fontWeight: '800', color: '#0f172a', fontSize: 17 },
  meta: { color: '#334155' }
});
