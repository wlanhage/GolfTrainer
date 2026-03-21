'use client';

import { useParams } from 'next/navigation';
import { HoleManager } from '../../../components/HoleManager';
import { NavShell } from '../../../components/NavShell';
import { courseRepo } from '../../../lib/storage';

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const course = courseRepo.find(params.courseId);

  return (
    <NavShell>
      {course ? <HoleManager initialCourse={course} /> : <div className="card"><h2>Banan hittades inte</h2></div>}
    </NavShell>
  );
}
