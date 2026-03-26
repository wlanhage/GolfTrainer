'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { computeHoleLength } from '../lib/holeMetrics';
import { courseRepo } from '../lib/storage';
import { Course } from '../lib/types';
import { ConfirmDialog } from './common/ConfirmDialog';
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
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [overviewCourse, setOverviewCourse] = useState<Course | null>(null);
  const [form, setForm] = useState({ clubName: '', courseName: '', teeName: '', holeCount: 18 as 9 | 18 });

  const reload = async () => {
    setLoading(true);
    try {
      setCourses(await courseRepo.list());
      setError(null);
    } catch {
      setError('Kunde inte läsa banor från servern.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const validation = useMemo(() => ({
    clubName: form.clubName.trim().length >= 2,
    courseName: form.courseName.trim().length >= 2,
    teeName: form.teeName.trim().length >= 1
  }), [form.clubName, form.courseName, form.teeName]);

  const canCreate = validation.clubName && validation.courseName && validation.teeName;

  const create = async () => {
    if (!canCreate) return;

    try {
      const created = await courseRepo.create({ ...form, clubName: form.clubName.trim(), courseName: form.courseName.trim(), teeName: form.teeName.trim() });
      setForm({ clubName: '', courseName: '', teeName: '', holeCount: 18 });
      await reload();
      push('Bana skapad', 'success');
      router.push(`/courses/${created.id}`);
    } catch {
      push('Kunde inte skapa bana', 'error');
    }
  };

  const hasLayerData = (course: Course['holes'][number]) => ({
    tee: Boolean(course.layout.teePoint),
    green: course.layout.greenPolygon.length > 2,
    fairway: course.layout.fairwayPolygon.length > 2,
    bunker: course.layout.bunkerPolygons.length > 0,
    trees: course.layout.treesPolygons.length > 0,
    ob: course.layout.obPolygons.length > 0
  });

  return (
    <>
      <PageHeader
        title="Banor & Hål"
        description="Skapa och hantera banor. Nästa steg efter skapande är att öppna hål-editorn."
        action={<button onClick={() => setDialogOpen(true)}>Export / Import</button>}
      />

      <div className="local-banner">Data synkas via backend och delas mellan klienter.</div>

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
          <button disabled={!canCreate} onClick={() => void create()}>Skapa bana</button>
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
            <div key={course.id} className="list-row static-row">
              <strong>{course.courseName}</strong>
              <span>{course.clubName} · {course.teeName} · {course.holeCount} hål</span>
              <div className="hole-list">
                <Link href={`/courses/${course.id}`} className="chip">Edit</Link>
                <button className="chip" onClick={() => setOverviewCourse(course)}>Översikt</button>
                <button className="chip" onClick={() => setDeleteTarget(course)}>Delete</button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <ExportImportDialog
        open={dialogOpen}
        courses={courses}
        onClose={() => setDialogOpen(false)}
        onImport={(payload) => {
          void (async () => {
            try {
              await courseRepo.saveAll(payload);
              await reload();
              push('Import klar', 'success');
            } catch {
              push('Import misslyckades', 'error');
            }
          })();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Ta bort bana"
        message={`Är du säker på att du vill ta bort "${deleteTarget?.courseName ?? ''}"?`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void (async () => {
            try {
              await courseRepo.remove(deleteTarget.id);
              setDeleteTarget(null);
              await reload();
              push('Bana borttagen', 'info');
            } catch {
              push('Kunde inte ta bort bana', 'error');
            }
          })();
        }}
      />

      {overviewCourse ? (
        <div className="dialog-overlay">
          <div className="dialog-box wide">
            <h3>{overviewCourse.courseName} · Översikt</h3>
            <p className="small-note">{overviewCourse.clubName} · {overviewCourse.teeName} · {overviewCourse.holeCount} hål</p>
            <div className="card-grid">
              {overviewCourse.holes.map((hole) => {
                const lengthMeters = hole.length ?? computeHoleLength(hole);
                const exists = hasLayerData(hole);
                return (
                  <div key={hole.id} className="list-row static-row">
                    <strong>Hål {hole.holeNumber}</strong>
                    <span>Par: {hole.par ?? '-'} · HCP: {hole.hcpIndex ?? '-'} · Längd: {lengthMeters ? `${lengthMeters} m` : '-'}</span>
                    <span className="small-note">
                      Data: {exists.tee ? 'Tee' : '-'} · {exists.green ? 'Green' : '-'} · {exists.fairway ? 'Fairway' : '-'} ·
                      {' '}Bunker ({hole.layout.bunkerPolygons.length}) · Träd ({hole.layout.treesPolygons.length}) · OB ({hole.layout.obPolygons.length})
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="dialog-actions">
              <button className="chip" onClick={() => setOverviewCourse(null)}>Stäng</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
