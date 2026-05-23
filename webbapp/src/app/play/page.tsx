'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCoursesApi } from '@/lib/api';
import { useRoundsStore } from '@/lib/roundsStore';
import { useToast } from '@/lib/ToastProvider';
import type { Course, GeoPoint, InProgressRoundSummary } from '@/lib/types';

const PAGE_SIZE = 5;

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const earthRadius = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m bort`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km bort`;
}

function matchesSearch(course: Course, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    course.courseName.toLowerCase().includes(q) ||
    course.clubName.toLowerCase().includes(q) ||
    (course.teeName?.toLowerCase().includes(q) ?? false)
  );
}

export default function PlayPage() {
  const api = useCoursesApi();
  const roundsStore = useRoundsStore();
  const toast = useToast();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseLocations, setCourseLocations] = useState<Record<string, GeoPoint | null>>({});
  const [coords, setCoords] = useState<GeoPoint | null>(null);
  const [inProgress, setInProgress] = useState<InProgressRoundSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [endTarget, setEndTarget] = useState<InProgressRoundSummary | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const refresh = useCallback(async () => {
    let list: Course[] = [];
    try {
      list = await api.listCourses('');
      setCourses(list);
      setError(null);
    } catch {
      setError('Kunde inte hämta banor.');
    }
    // Derive a course location from the average of the first three mapped tee points.
    const entries = await Promise.all(
      list.map(async (course): Promise<[string, GeoPoint | null]> => {
        try {
          const detail = await api.getCourseDetail(course.id);
          const teePoints = (detail?.holes ?? [])
            .map((hole) => hole.layout?.geometry.teePoint ?? null)
            .filter((point): point is GeoPoint => point != null)
            .slice(0, 3);
          if (teePoints.length === 0) return [course.id, null];
          return [
            course.id,
            {
              lat: teePoints.reduce((sum, p) => sum + p.lat, 0) / teePoints.length,
              lng: teePoints.reduce((sum, p) => sum + p.lng, 0) / teePoints.length
            }
          ];
        } catch {
          return [course.id, null];
        }
      })
    );
    setCourseLocations(Object.fromEntries(entries));
    if (roundsStore.ready) {
      try {
        setInProgress(await roundsStore.listInProgress());
      } catch {
        setInProgress([]);
      }
    }
  }, [api, roundsStore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null),
      { timeout: 8000, maximumAge: 300_000 }
    );
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const distanceFor = useCallback(
    (courseId: string): number | null => {
      const location = courseLocations[courseId];
      if (!coords || !location) return null;
      return haversineMeters(coords, location);
    },
    [coords, courseLocations]
  );

  const filteredCourses = useMemo(() => {
    const filtered = courses.filter((course) => matchesSearch(course, search));
    if (!coords) return filtered;
    return [...filtered].sort((a, b) => {
      const da = distanceFor(a.id);
      const db = distanceFor(b.id);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [courses, search, coords, distanceFor]);

  const visibleCourses = filteredCourses.slice(0, visibleCount);
  const canLoadMore = filteredCourses.length > visibleCount;
  const showSearch = courses.length > PAGE_SIZE;

  const onCoursePick = async (course: Course) => {
    try {
      const detail = await api.getCourseDetail(course.id);
      if (!detail) throw new Error('Banan hittades inte.');
      if (detail.holes.length === 0) {
        await api.ensureHoles(course.id, course.holeCount);
      }
      router.push(`/play/group/${course.id}`);
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

      <p className="text-slate-700 text-sm">
        Välj bana — lägg sen till spelare (eller spela själv) och välj spelform.
      </p>

      {inProgress.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-ink">Pågående rundor</h2>
          {inProgress.map((round) => (
            <Link
              key={round.roundId}
              href={`/play/round/${round.roundId}/${round.currentHoleNumber}`}
              className="relative block overflow-hidden rounded-2xl border border-primary/30 bg-primary-softer p-4"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-primary/15 animate-breathe"
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider font-bold text-primary">Fortsätt runda</p>
                  <p className="font-extrabold text-ink truncate">{round.courseName}</p>
                  <p className="text-slate-700 text-sm">
                    {round.clubName} • Hål {round.currentHoleNumber}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEndTarget(round);
                  }}
                  aria-label="Avsluta runda"
                  className="shrink-0 w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-danger active:bg-slate-100"
                >
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      {showSearch ? (
        <input
          placeholder="Sök bana eller klubb"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
      ) : null}

      <Link href="/play/add" className="btn-primary text-center">
        + Lägg till bana
      </Link>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <div className="flex flex-col gap-2.5 mt-1">
        {visibleCourses.map((course) => {
          const distance = distanceFor(course.id);
          return (
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
              {distance != null ? (
                <span className="text-xs font-semibold text-primary">{formatDistance(distance)}</span>
              ) : null}
            </button>
          );
        })}
        {filteredCourses.length === 0 && !error ? (
          <p className="text-center text-slate-500 mt-3">Inga banor hittades.</p>
        ) : null}
      </div>

      {canLoadMore ? (
        <button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="btn-ghost">
          Ladda fler banor ({filteredCourses.length - visibleCount} kvar)
        </button>
      ) : null}

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
