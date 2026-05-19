'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CourseForm, type CourseFormValues } from '@/components/CourseForm';
import { useCoursesApi } from '@/lib/api';
import { useToast } from '@/lib/ToastProvider';
import { validateCourseInput } from '@/lib/validation';

export default function AddCoursePage() {
  const router = useRouter();
  const api = useCoursesApi();
  const toast = useToast();
  const [values, setValues] = useState<CourseFormValues>({
    clubName: '',
    courseName: '',
    teeName: '',
    holeCount: 9
  });

  const onCreate = async () => {
    const validation = validateCourseInput({ ...values });
    if (validation) {
      toast.error(validation);
      return;
    }
    try {
      const created = await api.createCourse({
        clubName: values.clubName,
        courseName: values.courseName,
        teeName: values.teeName,
        holeCount: values.holeCount
      });
      router.push(`/play/scorecard/${created.id}`);
    } catch (e) {
      toast.error(`Kunde inte skapa bana: ${(e as Error).message}`);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold text-ink">Ny bana</h1>
      <CourseForm values={values} onChange={setValues} onSubmit={onCreate} submitLabel="Starta runda och bygg bana" />
    </div>
  );
}
