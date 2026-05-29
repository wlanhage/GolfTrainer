'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { HoleManager } from '../../../components/HoleManager';
import { courseRepo } from '../../../lib/storage';
import { Course } from '../../../lib/types';

// The HoleEditor is a full-screen fixed overlay — NavShell is intentionally
// omitted here. The editor has its own back-navigation breadcrumb.
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

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0b1220', color: '#f3f4f6', fontFamily: 'system-ui' }}>
        Laddar bana...
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0b1220', color: '#f3f4f6', fontFamily: 'system-ui' }}>
        Banan hittades inte.{' '}
        <a href="/courses" style={{ color: '#22c55e', marginLeft: 8 }}>Tillbaka</a>
      </div>
    );
  }

  return <HoleManager initialCourse={course} />;
}
