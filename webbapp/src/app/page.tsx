'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useFollowsApi, useTrainingApi } from '@/lib/api';
import { useRoundsStore, type LatestRoundSummary } from '@/lib/roundsStore';
import { formatRelativeShort } from '@/lib/format';
import { useT } from '@/lib/i18n/I18nProvider';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/Skeleton';
import { NotificationBell } from '@/components/NotificationBell';
import type { FollowingFeedEntry, InProgressRoundSummary, TrainingMission } from '@/lib/types';

const greetingKey = (date: Date): string => {
  const h = date.getHours();
  if (h < 5) return 'home.goodNight';
  if (h < 11) return 'home.goodMorning';
  if (h < 17) return 'home.goodAfternoon';
  if (h < 22) return 'home.goodEvening';
  return 'home.goodNight';
};

// Stabil pick per dag — alla användare ser samma mission på samma datum.
const dailyMissionIndex = (dateIso: string, len: number) => {
  if (len === 0) return 0;
  let h = 0;
  for (let i = 0; i < dateIso.length; i += 1) {
    h = (h * 31 + dateIso.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % len;
};

const formatRelDate = formatRelativeShort;

export default function HomePage() {
  const { me } = useAuth();
  const t = useT();
  const followsApi = useFollowsApi();
  const trainingApi = useTrainingApi();
  const roundsStore = useRoundsStore();

  const [inProgress, setInProgress] = useState<InProgressRoundSummary[]>([]);
  const [latest, setLatest] = useState<LatestRoundSummary | null>(null);
  const [feed, setFeed] = useState<FollowingFeedEntry[] | null>(null);
  const [missions, setMissions] = useState<TrainingMission[] | null>(null);

  const greeting = useMemo(() => t(greetingKey(new Date())), [t]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!roundsStore.ready) return;
    void roundsStore.listInProgress().then(setInProgress).catch(() => setInProgress([]));
    void roundsStore.getLatestFinished().then(setLatest).catch(() => setLatest(null));
  }, [roundsStore]);

  useEffect(() => {
    followsApi.getFollowingFeed(5).then(setFeed).catch(() => setFeed([]));
  }, [followsApi]);

  useEffect(() => {
    trainingApi.listMissions().then(setMissions).catch(() => setMissions([]));
  }, [trainingApi]);

  const dailyMission = missions && missions.length > 0 ? missions[dailyMissionIndex(todayIso, missions.length)] : null;
  const ongoing = inProgress[0] ?? null;
  const displayName = me?.profile?.displayName ?? me?.email ?? '';
  const handicap = me?.profile?.handicap;

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* 1. Hero header */}
      <section className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-500">{greeting},</p>
            <h1 className="text-2xl font-extrabold text-ink truncate">{displayName}</h1>
            {handicap !== null && handicap !== undefined ? (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                HCP {handicap}
              </span>
            ) : (
              <Link
                href="/profile"
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary-soft text-primary text-xs font-bold border border-primary"
              >
                {t('home.setHcp')}
              </Link>
            )}
          </div>
          <div className="scale-125 origin-right">
            <NotificationBell />
          </div>
        </div>
      </section>

      {/* 2. Primär CTA */}
      <section className="px-4">
        {ongoing ? (
          <Link
            href={`/play/round/${ongoing.roundId}/${ongoing.currentHoleNumber}`}
            className="relative block text-white rounded-2xl p-5 shadow-md overflow-hidden"
          >
            <img src="/golf-green.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-emerald-700/60" />
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-wider opacity-80">{t('home.ongoingRound')}</p>
              <p className="text-xl font-extrabold mt-1">{t('home.continueOn')} {ongoing.courseName}</p>
              <p className="text-sm opacity-90 mt-1">
                {ongoing.clubName} · {t('home.holeShort')} {ongoing.currentHoleNumber}
              </p>
              <p className="text-right text-2xl mt-2">›</p>
            </div>
          </Link>
        ) : (
          <Link
            href="/play"
            className="relative block text-white rounded-2xl p-6 shadow-md text-center overflow-hidden"
          >
            <img src="/golf-green.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-emerald-700/70" />
            <div className="relative z-10">
              <p className="text-3xl font-extrabold">▶ {t('title.play')}</p>
              <p className="text-sm opacity-90 mt-1">{t('home.startNewRound')}</p>
            </div>
          </Link>
        )}
      </section>

      {/* 3. Aktivitet — följda spelare */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-lg font-extrabold text-ink">{t('home.activity')}</h2>
          <Link href="/community" className="text-sm text-primary font-semibold">
            {t('home.seeMore')}
          </Link>
        </div>

        {feed === null ? (
          <div className="flex gap-3 overflow-x-auto px-4 pb-2">
            <Skeleton className="shrink-0 w-[70%] h-32" rounded="xl" />
            <Skeleton className="shrink-0 w-[70%] h-32" rounded="xl" />
          </div>
        ) : feed.length === 0 ? (
          <div className="mx-4 bg-white border border-border rounded-xl p-4 text-center">
            <p className="text-slate-600 text-sm">{t('home.noFollowedActivity')}</p>
            <Link
              href="/community"
              className="inline-block mt-2 text-primary font-semibold text-sm"
            >
              {t('home.searchInCommunity')}
            </Link>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
            {feed.map((entry) => (
              <Link
                key={entry.roundId}
                href={`/u/${entry.userId}`}
                className="snap-start shrink-0 w-[70%] bg-white border border-border rounded-2xl p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar displayName={entry.username} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink truncate">{entry.username}</p>
                    <p className="text-xs text-slate-500">{formatRelDate(entry.startedAt)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-700 truncate">{entry.course}</p>
                  <p className="text-2xl font-extrabold text-primary mt-1">{entry.totalScore}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 4. Din senaste runda */}
      {latest ? (
        <section className="px-4">
          <h2 className="text-lg font-extrabold text-ink mb-2">{t('home.lastRound')}</h2>
          <Link
            href={`/play/round/${latest.roundId}/overview`}
            className="block bg-white border border-border rounded-2xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink truncate">{latest.courseName}</p>
                <p className="text-xs text-slate-500">
                  {latest.clubName} · {formatRelDate(latest.finishedAt ?? latest.startedAt)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {latest.completedHoles}/{latest.totalHoles} hål · {latest.status === 'completed' ? 'Avslutad' : 'Övergiven'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-primary leading-none">{latest.totalScore}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {latest.relativeToPar === null
                    ? `Par ${latest.totalPar}`
                    : latest.relativeToPar > 0
                      ? `+${latest.relativeToPar} mot par`
                      : latest.relativeToPar < 0
                        ? `${latest.relativeToPar} mot par`
                        : 'Even par'}
                </p>
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {/* 5. Dagens träning */}
      {dailyMission ? (
        <section className="px-4">
          <h2 className="text-lg font-extrabold text-ink mb-2">{t('home.dailyTraining')}</h2>
          <Link
            href={`/training/${dailyMission.id}`}
            className="block bg-white border border-border rounded-2xl p-4 flex items-center gap-3"
          >
            <span className="text-4xl">{dailyMission.symbol}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-ink truncate">{dailyMission.title}</p>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{dailyMission.objective}</p>
            </div>
            <span className="text-slate-400 text-lg">›</span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
