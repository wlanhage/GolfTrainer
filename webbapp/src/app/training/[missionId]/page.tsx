'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFollowsApi, useTrainingApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { formatDate } from '@/lib/format';
import type {
  LeaderboardFilter,
  MissionHistory,
  MissionSubmitResult,
  TrainingMission
} from '@/lib/types';

const FILTERS: { key: LeaderboardFilter; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'friends', label: 'Personer jag följer' },
  { key: 'mine', label: 'Mitt resultat' }
];

const draftKey = (userId: string | undefined, missionId: string) =>
  `golftrainer.webbapp.missionDraft.v1:${userId ?? 'anon'}:${missionId}`;

export default function MissionPage() {
  const params = useParams();
  const missionId = String(params?.missionId ?? '');
  const { me } = useAuth();
  const api = useTrainingApi();
  const followsApi = useFollowsApi();

  const [mission, setMission] = useState<TrainingMission | null>(null);
  const [history, setHistory] = useState<MissionHistory | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<LeaderboardFilter>('all');
  const [stepperScore, setStepperScore] = useState(0);
  const [manualScore, setManualScore] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<MissionSubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const m = await api.getMissionById(missionId);
      setMission(m);

      const stored =
        typeof window !== 'undefined' ? window.localStorage.getItem(draftKey(me?.id, missionId)) : null;
      const defaultStep =
        m.defaultScore != null
          ? Math.min(Math.max(m.defaultScore, m.stepperMin ?? -Infinity), m.stepperMax ?? Infinity)
          : 0;
      if (stored && Number.isFinite(Number(stored))) {
        setStepperScore(Number(stored));
        setManualScore(stored);
      } else {
        setStepperScore(defaultStep);
        setManualScore(String(m.defaultScore ?? ''));
      }
      setLoadError(null);

      const h = await api.getMyHistory(missionId).catch(() => null);
      setHistory(h);
    } catch {
      setMission(null);
      setLoadError('Kunde inte ladda missionen.');
    }
  }, [api, missionId, me?.id]);

  useEffect(() => {
    if (!missionId) return;
    void reload();
  }, [reload, missionId]);

  useEffect(() => {
    if (!me?.id) return;
    followsApi
      .listFollowing(me.id, 200)
      .then((rows) => setFollowingIds(new Set(rows.map((r) => r.userId))))
      .catch(() => setFollowingIds(new Set()));
  }, [followsApi, me?.id]);

  useEffect(() => {
    if (!mission || mission.scoreInputType !== 'stepper' || typeof window === 'undefined') return;
    window.localStorage.setItem(draftKey(me?.id, missionId), String(stepperScore));
  }, [stepperScore, missionId, mission, me?.id]);

  const enrichedEntries = useMemo(() => {
    if (!mission) return [];
    return mission.leaderboard.map((entry) => ({
      ...entry,
      isCurrentUser: entry.userId === me?.id,
      isFriend: followingIds.has(entry.userId)
    }));
  }, [mission, me?.id, followingIds]);

  const filteredEntries = useMemo(() => {
    if (filter === 'friends') return enrichedEntries.filter((e) => e.isFriend);
    if (filter === 'mine') return enrichedEntries.filter((e) => e.isCurrentUser);
    return enrichedEntries;
  }, [enrichedEntries, filter]);

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold">Mission saknas</h2>
        <p className="text-slate-600 mt-1">{loadError}</p>
      </div>
    );
  }

  if (!mission) {
    return <div className="p-8 text-center text-slate-500">Laddar...</div>;
  }

  const finalScore = mission.scoreInputType === 'manual' ? Number(manualScore) : stepperScore;
  const scoreValid = Number.isFinite(finalScore);
  const lowerIsBetter = mission.scoreDirection === 'ASC';

  const submit = async () => {
    if (!scoreValid) {
      setSubmitError('Skriv in ett giltigt nummer.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.submitEntry(missionId, {
        score: finalScore,
        notes: notes.trim() ? notes.trim() : undefined
      });
      setLastResult(result);
      setNotes('');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey(me?.id, missionId));
      }
      await reload();
    } catch (e) {
      setSubmitError((e as Error).message || 'Kunde inte spara resultatet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-3xl font-bold">
        {mission.symbol} {mission.title}
      </h1>
      <p className="text-slate-700 leading-relaxed">{mission.description}</p>
      <p className="text-primary font-semibold">{mission.objective}</p>

      {history && history.best !== null ? (
        <div className="card flex items-center justify-between gap-3 bg-primary-softer border-primary">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Din PB</p>
            <p className="text-2xl font-extrabold text-ink">{history.best}</p>
          </div>
          {history.rank ? (
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Placering</p>
              <p className="text-2xl font-extrabold text-ink">#{history.rank}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card flex flex-col gap-3">
        <h2 className="font-bold text-lg">
          {mission.scoreLabel}
          {lowerIsBetter ? <span className="ml-1 text-xs font-normal text-slate-500">(lägre = bättre)</span> : null}
        </h2>

        {mission.scoreInputType === 'manual' ? (
          <input
            value={manualScore}
            onChange={(e) => setManualScore(e.target.value)}
            inputMode="decimal"
            type="number"
            placeholder="Skriv in poäng"
            className="border-2 border-primary rounded-xl px-4 py-6 text-center text-4xl font-bold bg-primary-softer focus:outline-none"
          />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setStepperScore((p) => Math.max(mission.stepperMin ?? 0, p - 1))}
              className="w-20 h-20 rounded-2xl bg-primary text-white text-4xl font-bold active:bg-primary-dark"
            >
              −
            </button>
            <div className="flex-1 h-20 border-2 border-primary rounded-2xl flex items-center justify-center bg-primary-softer text-4xl font-bold text-ink">
              {stepperScore}
            </div>
            <button
              onClick={() => setStepperScore((p) => Math.min(mission.stepperMax ?? 10, p + 1))}
              className="w-20 h-20 rounded-2xl bg-primary text-white text-4xl font-bold active:bg-primary-dark"
            >
              +
            </button>
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anteckning (valfritt) — t.ex. vindförhållanden, ny boll"
          rows={2}
          className="border border-border rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-primary resize-none text-sm"
        />

        {submitError ? <p className="text-danger text-sm">{submitError}</p> : null}

        <button onClick={() => void submit()} disabled={submitting || !scoreValid} className="btn-primary disabled:opacity-50">
          {submitting ? 'Sparar...' : 'Spara resultat'}
        </button>

        {lastResult ? (
          <div
            className={`rounded-xl p-3 text-center ${
              lastResult.isPB ? 'bg-primary text-white' : 'bg-primary-softer text-ink border border-border'
            }`}
          >
            {lastResult.isPB ? (
              <p className="font-extrabold">🏆 Nytt personligt rekord!</p>
            ) : (
              <p className="font-semibold">Resultat sparat</p>
            )}
            <p className="text-sm mt-0.5 opacity-90">
              Score {lastResult.entry.score} · Placering #{lastResult.rank}
              {lastResult.previousBest !== null && !lastResult.isPB ? ` · PB ${lastResult.previousBest}` : ''}
            </p>
          </div>
        ) : null}
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-bold text-lg">Leaderboard</h2>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-2 text-xs font-semibold border-2 transition ${
                  active ? 'bg-primary border-primary text-white' : 'border-border bg-white text-slate-700'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {filteredEntries.map((entry, idx) => (
            <div key={entry.id} className="flex items-center gap-3">
              <span className="w-5 text-slate-500 font-bold">{idx + 1}.</span>
              <div
                className={`flex-1 flex items-center justify-between border rounded-lg px-3 py-2 ${
                  entry.isCurrentUser
                    ? 'bg-primary text-white border-primary'
                    : 'bg-primary-softer border-border text-ink'
                }`}
              >
                <span className="font-semibold">{entry.playerName}</span>
                <span className={`font-bold ${entry.isCurrentUser ? 'text-white' : 'text-primary'}`}>{entry.score}</span>
              </div>
            </div>
          ))}
          {filteredEntries.length === 0 ? (
            <p className="text-slate-500 text-sm">
              {filter === 'friends'
                ? 'Inga personer du följer har resultat ännu.'
                : filter === 'mine'
                  ? 'Du har inga sparade resultat ännu.'
                  : 'Inga resultat ännu — bli först!'}
            </p>
          ) : null}
        </div>
      </div>

      {history && history.entries.length > 0 ? (
        <div className="card flex flex-col gap-2">
          <h2 className="font-bold text-lg">Min historik</h2>
          {history.entries.slice(0, 10).map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-b border-slate-100 last:border-b-0 py-1.5">
              <div>
                <span className="font-semibold text-ink">{e.score}</span>
                {e.notes ? <span className="text-slate-500 ml-2">· {e.notes}</span> : null}
              </div>
              <span className="text-xs text-slate-500">{formatDate(e.submittedAt)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
