'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CourseForm, type CourseFormValues } from '@/components/CourseForm';
import { useCoursesApi, type CourseDetail } from '@/lib/api';
import { useToast } from '@/lib/ToastProvider';
import { Loader } from '@/components/Loader';

export default function AdminCourseDetailsPage() {
  const params = useParams();
  const courseId = String(params?.courseId ?? '');
  const api = useCoursesApi();
  const toast = useToast();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [form, setForm] = useState<CourseFormValues>({ clubName: '', courseName: '', teeName: '', holeCount: 9 });

  const load = useCallback(async () => {
    const data = await api.getCourseDetail(courseId);
    if (!data) return;
    setDetail(data);
    setForm({
      clubName: data.course.clubName,
      courseName: data.course.courseName,
      teeName: data.course.teeName ?? '',
      holeCount: data.course.holeCount
    });
  }, [api, courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const missingHoleCount = useMemo(
    () => (detail ? Math.max(detail.course.holeCount - detail.holes.length, 0) : 0),
    [detail]
  );

  if (!detail) return <Loader label="Laddar bana" />;

  const onSave = async () => {
    try {
      await api.updateCourse(courseId, form);
      await load();
      toast.success('Banan är uppdaterad.');
    } catch (e) {
      toast.error(`Kunde inte spara bana: ${(e as Error).message}`);
    }
  };

  const createMissing = async () => {
    await api.ensureHoles(detail.course.id, detail.course.holeCount);
    await load();
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold text-ink">Admin · {detail.course.courseName}</h1>
      <CourseForm values={form} onChange={setForm} onSubmit={onSave} submitLabel="Spara bana" />

      <div className="flex flex-col gap-2 mt-2">
        <h2 className="text-xl font-bold">Hål ({detail.holes.length}/{detail.course.holeCount})</h2>
        {missingHoleCount > 0 ? (
          <button onClick={() => void createMissing()} className="self-start bg-primary-soft text-primary-dark font-bold rounded-lg px-3 py-2 border-2 border-primary">
            Skapa saknade hål ({missingHoleCount})
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        {detail.holes.map((hole) => {
          const metaComplete = hole.par !== null && hole.length !== null && hole.hcpIndex !== null;
          const layoutStatus = hole.layout?.layoutStatus ?? 'not_started';
          return (
            <Link
              key={hole.id}
              href={`/admin/courses/${courseId}/hole/${hole.holeNumber}`}
              className="card flex flex-col gap-0.5 active:bg-primary-softer"
            >
              <span className="text-base font-extrabold text-ink">Hål {hole.holeNumber}</span>
              <span className="text-slate-700">Metadata: {metaComplete ? 'komplett' : 'saknas/delvis'}</span>
              <span className="text-slate-700">Layout: {layoutStatus}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
