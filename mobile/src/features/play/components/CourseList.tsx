import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Course } from '../types/play';

type Props = {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
};

export function CourseList({ courses, onSelectCourse }: Props) {
  return (
    <View style={styles.list}>
      {courses.map((course) => (
        <Pressable key={course.id} style={styles.card} onPress={() => onSelectCourse(course)}>
          <Text style={styles.title}>{course.courseName}</Text>
          <Text style={styles.subtitle}>{course.clubName}</Text>
          <Text style={styles.meta}>{course.holeCount} hål • {course.teeName ?? 'Tee ej satt'}</Text>
        </Pressable>
      ))}
      {courses.length === 0 ? <Text style={styles.empty}>Inga banor hittades.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 3
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 15, color: '#334155' },
  meta: { fontSize: 13, color: '#475569' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 12 }
});
