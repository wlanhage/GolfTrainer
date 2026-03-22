'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { courseRepo } from '../lib/storage';
import { Course } from '../lib/types';
import { EmptyState } from './common/EmptyState';
import { ExportImportDialog } from './common/ExportImportDialog';
import { PageHeader } from './common/PageHeader';
import { useToast } from './common/ToastProvider';

export function CourseBuilder() {
  const { push } = useToast();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ clubName: '', courseName: '', teeName: '', holeCount: 18 as 9 | 18 });

  const reload = () => {
    try {
      setCourses(courseRepo.list());
      setError(null);
    } catch {
      setError('Kunde inte läsa lokalt sparade banor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => reload(), []);

  const validation = useMemo(() => ({
    clubName: form.clubName.trim().length >= 2,
    courseName: form.courseName.trim().length >= 2,
    teeName: form.teeName.trim().length >= 1
  }), [form.clubName, form.courseName, form.teeName]);

  const canCreate = validation.clubName && validation.courseName && validation.teeName;

  const create = () => {
    if (!canCreate) return;
    const created = courseRepo.create({ ...form, clubName: form.clubName.trim(), courseName: form.courseName.trim(), teeName: form.teeName.trim() });
    setForm({ clubName: '', courseName: '', teeName: '', holeCount: 18 });
    reload();
    push('Bana skapad', 'success');
    router.push(`/courses/${created.id}`);
  };

  return (
    <>
      <PageHeader
        title="Banor & Hål"
        description="Skapa och hantera banor. Nästa steg efter skapande är att öppna hål-editorn."
        action={<button onClick={() => setDialogOpen(true)}>Export / Import</button>}
      />

      <div className="local-banner">Data sparas lokalt i denna webbläsare.</div>

      <div className="card-grid">
        <section className="card">
          <h2>Skapa bana</h2>
          <p className="small-note">Sektioner: Klubb • Bana • Tee • Hål.</p>
          <input placeholder="Klubbnamn" value={form.clubName} onChange={(event) => setForm((prev) => ({ ...prev, clubName: event.target.value }))} />
          {!validation.clubName ? <p className="field-error">Minst 2 tecken.</p> : null}
          <input placeholder="Banans namn" value={form.courseName} onChange={(event) => setForm((prev) => ({ ...prev, courseName: event.target.value }))} />
          {!validation.courseName ? <p className="field-error">Minst 2 tecken.</p> : null}
          <input placeholder="Tee" value={form.teeName} onChange={(event) => setForm((prev) => ({ ...prev, teeName: event.target.value }))} />
          {!validation.teeName ? <p className="field-error">Tee krävs.</p> : null}
          <select value={form.holeCount} onChange={(event) => setForm((prev) => ({ ...prev, holeCount: Number(event.target.value) as 9 | 18 }))}>
            <option value={9}>9 hål</option>
            <option value={18}>18 hål</option>
          </select>
          <button disabled={!canCreate} onClick={create}>Skapa bana</button>
          <div className="empty-state">
            <h3>Preview</h3>
            <p><strong>{form.courseName || 'Banans namn'}</strong> · {form.teeName || 'Tee'} · {form.holeCount} hål</p>
          </div>
          <p className="small-note">Nästa steg: öppna banan och börja med hål 1.</p>
        </section>

        <section className="card">
          <h2>Befintliga banor</h2>
          {loading ? <p>Laddar banor...</p> : null}
          {error ? <p>{error}</p> : null}
          {!loading && !error && courses.length === 0 ? (
            <EmptyState title="Inga banor ännu" description="Skapa din första bana i formuläret till vänster." />
          ) : null}
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="list-row">
              <strong>{course.courseName}</strong>
              <span>{course.clubName} · {course.teeName} · {course.holeCount} hål</span>
            </Link>
          ))}
        </section>
      </div>

      <ExportImportDialog
        open={dialogOpen}
        courses={courses}
        onClose={() => setDialogOpen(false)}
        onImport={(payload) => {
          courseRepo.saveAll(payload);
          reload();
          push('Import klar', 'success');
        }}
      />
    </>
  );
}
