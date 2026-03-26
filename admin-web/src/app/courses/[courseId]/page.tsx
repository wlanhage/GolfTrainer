'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { HoleManager } from '../../../components/HoleManager';
import { NavShell } from '../../../components/NavShell';
import { courseRepo } from '../../../lib/storage';
import { Course } from '../../../lib/types';

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const found = await courseRepo.find(params.courseId);
      setCourse(found);
      setLoading(false);
    })();
  }, [params.courseId]);

  return (
    <NavShell>
      {loading ? <div className="card"><h2>Laddar bana...</h2></div> : null}
      {!loading && course ? <HoleManager initialCourse={course} /> : null}
      {!loading && !course ? <div className="card"><h2>Banan hittades inte</h2></div> : null}
    </NavShell>
  );
}
