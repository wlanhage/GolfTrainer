'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useCoursesApi } from '@/lib/api';
import { useRoundsStore } from '@/lib/roundsStore';
import { useToast } from '@/lib/ToastProvider';
import type { Course, InProgressRoundSummary } from '@/lib/types';

export default function PlayPage() {
  const api = useCoursesApi();
  const roundsStore = useRoundsStore();
  const toast = useToast();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [inProgress, setInProgress] = useState<InProgressRoundSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [endTarget, setEndTarget] = useState<InProgressRoundSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCourses(await api.listCourses(search));
    } catch {
      setError('Kunde inte hämta banor.');
    }
    if (roundsStore.ready) {
      try {
        setInProgress(await roundsStore.listInProgress());
      } catch {
        setInProgress([]);
      }
    }
  }, [api, search, roundsStore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [mode, setMode] = useState<'solo' | 'group'>('solo');

  const onCoursePick = async (course: Course) => {
    try {
      const detail = await api.getCourseDetail(course.id);
      if (!detail) throw new Error('Banan hittades inte.');
      if (detail.holes.length === 0) {
        await api.ensureHoles(course.id, course.holeCount);
      }
      if (mode === 'solo') {
        router.push(`/play/format?mode=solo&courseId=${course.id}`);
      } else {
        router.push(`/play/group/${course.id}`);
      }
    } catch (e) {
      toast.error(`Kunde inte starta runda: ${(e as Error).message}`);
    }
  };

  const endRoundWith = async (action: 'save' | 'delete') => {
    if (!endTarget) return;
    const message =
      action === 'save'
        ? 'Är du säker på att du vill avsluta och spara rundan?'
        : 'Är du säker på att du vill avsluta och ta bort rundan?';
    if (!window.confirm(message)) return;
    try {
      await roundsStore.abandonRound(endTarget.roundId, action);
    } catch (e) {
      toast.error(`Kunde inte avsluta runda: ${(e as Error).message}`);
    }
    setEndTarget(null);
    void refresh();
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold text-ink">Spela</h1>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('solo')}
          className={`rounded-xl border-2 py-4 font-bold ${
            mode === 'solo' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'
          }`}
        >
          🏌️ Spela ensam
        </button>
        <button
          onClick={() => setMode('group')}
          className={`rounded-xl border-2 py-4 font-bold ${
            mode === 'group' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'
          }`}
        >
          👥 Spela i grupp
        </button>
      </div>

      <p className="text-slate-700 text-sm">
        {mode === 'solo' ? 'Välj bana — du väljer spelform i nästa steg.' : 'Välj bana — lägg sen till spelare och välj spelform.'}
      </p>

      {inProgress.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-ink">Pågående rundor</h2>
          {inProgress.map((round) => (
            <div key={round.roundId} className="card flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="font-bold text-ink">{round.courseName}</p>
                <p className="text-slate-600 text-sm">{round.clubName} • Hål {round.currentHoleNumber}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => setEndTarget(round)} className="text-danger font-bold text-sm">
                  Avsluta
                </button>
                <Link
                  href={`/play/round/${round.roundId}/${round.currentHoleNumber}`}
                  className="bg-primary text-white rounded-lg px-3 py-2 font-bold text-sm"
                >
                  Fortsätt
                </Link>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <input
        placeholder="Sök bana eller klubb"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input"
      />

      <Link href="/play/add" className="btn-primary text-center">
        + Lägg till bana
      </Link>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <div className="flex flex-col gap-2.5 mt-1">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => void onCoursePick(course)}
            className="card text-left flex flex-col gap-1 active:bg-primary-softer"
          >
            <span className="text-lg font-bold text-ink">{course.courseName}</span>
            <span className="text-sm text-slate-700">{course.clubName}</span>
            <span className="text-xs text-slate-600">
              {course.holeCount} hål • {course.teeName ?? 'Tee ej satt'}
            </span>
          </button>
        ))}
        {courses.length === 0 && !error ? <p className="text-center text-slate-500 mt-3">Inga banor hittades.</p> : null}
      </div>

      {endTarget ? (
        <div className="fixed inset-0 z-40 bg-slate-900/45 flex flex-col justify-end">
          <button className="flex-1" aria-label="Stäng" onClick={() => setEndTarget(null)} />
          <div className="bg-white rounded-t-2xl p-4 flex flex-col gap-3">
            <h3 className="text-lg font-extrabold">Avsluta runda</h3>
            <p className="text-sm text-slate-600">Vill du avsluta rundan och spara, eller ta bort den?</p>
            <button onClick={() => void endRoundWith('save')} className="btn-primary">
              Avsluta och spara
            </button>
            <button onClick={() => void endRoundWith('delete')} className="btn-danger">
              Avsluta och ta bort
            </button>
            <button onClick={() => setEndTarget(null)} className="btn-ghost">
              Avbryt
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
