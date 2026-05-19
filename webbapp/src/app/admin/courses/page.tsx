'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useCoursesApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Course } from '@/lib/types';

export default function AdminCoursesPage() {
  const api = useCoursesApi();
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);

  const refresh = useCallback(() => {
    api.listCourses(search).then(setCourses).catch(() => undefined);
  }, [api, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold text-ink">Admin · Banor</h1>
      <input
        placeholder="Sök bana eller klubb"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input"
      />
      <button onClick={refresh} className="btn-secondary self-start py-2 px-3 text-sm">
        Uppdatera lista
      </button>

      <div className="flex flex-col gap-2.5">
        {courses.map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`} className="card flex flex-col gap-1 active:bg-primary-softer">
            <span className="text-lg font-extrabold text-ink">{course.courseName}</span>
            <span className="text-slate-700 font-semibold">{course.clubName}</span>
            <span className="text-slate-700 font-semibold">{course.holeCount} hål • {course.teeName ?? 'Ingen tee'}</span>
            <span className="text-xs text-slate-500">Senast uppdaterad: {formatDateTime(course.updatedAt)}</span>
            <span className="text-xs text-slate-500">
              source: {course.source} • localOnly: {course.localOnly ? 'ja' : 'nej'} • sync: {course.syncStatus}
            </span>
          </Link>
        ))}
        {courses.length === 0 ? <p className="text-center text-slate-500 mt-6">Inga banor hittades.</p> : null}
      </div>
    </div>
  );
}
