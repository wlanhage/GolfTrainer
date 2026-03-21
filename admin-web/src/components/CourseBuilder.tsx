'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { courseRepo } from '../lib/storage';
import { Course } from '../lib/types';

export function CourseBuilder() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ clubName: '', courseName: '', teeName: '', holeCount: 18 as 9 | 18 });

  const reload = () => setCourses(courseRepo.list());
  useEffect(() => reload(), []);

  const canCreate = useMemo(
    () => form.clubName.trim() && form.courseName.trim() && form.teeName.trim(),
    [form.clubName, form.courseName, form.teeName]
  );

  const create = () => {
    if (!canCreate) return;
    courseRepo.create({ ...form, clubName: form.clubName.trim(), courseName: form.courseName.trim(), teeName: form.teeName.trim() });
    setForm({ clubName: '', courseName: '', teeName: '', holeCount: 18 });
    reload();
  };

  return (
    <div className="card-grid">
      <section className="card">
        <h2>Skapa bana</h2>
        <p>Detaljerad wireframe-version av mobilflödet men optimerat för admin på desktop.</p>
        <input placeholder="Klubbnamn" value={form.clubName} onChange={(event) => setForm((prev) => ({ ...prev, clubName: event.target.value }))} />
        <input placeholder="Banans namn" value={form.courseName} onChange={(event) => setForm((prev) => ({ ...prev, courseName: event.target.value }))} />
        <input placeholder="Tee" value={form.teeName} onChange={(event) => setForm((prev) => ({ ...prev, teeName: event.target.value }))} />
        <select value={form.holeCount} onChange={(event) => setForm((prev) => ({ ...prev, holeCount: Number(event.target.value) as 9 | 18 }))}>
          <option value={9}>9 hål</option>
          <option value={18}>18 hål</option>
        </select>
        <button disabled={!canCreate} onClick={create}>Skapa bana</button>
      </section>

      <section className="card">
        <h2>Befintliga banor</h2>
        {courses.length === 0 ? <p>Inga banor ännu.</p> : null}
        {courses.map((course) => (
          <Link key={course.id} href={`/courses/${course.id}`} className="list-row">
            <strong>{course.courseName}</strong>
            <span>{course.clubName} · {course.teeName} · {course.holeCount} hål</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
