'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AdminRound, RoundStatus } from '../lib/types';
import { EmptyState } from './common/EmptyState';
import { PageHeader } from './common/PageHeader';
import { EntityStatusBadge } from './common/EntityStatusBadge';

type Stats = Awaited<ReturnType<typeof api.adminRoundStats>>;

const STATUS_TONE: Record<RoundStatus, 'green' | 'yellow' | 'red' | 'blue'> = {
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  ABANDONED: 'red'
};

const STATUS_LABEL: Record<RoundStatus, string> = {
  IN_PROGRESS: 'Pågående',
  COMPLETED: 'Avslutad',
  ABANDONED: 'Avbruten'
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDuration(startedAt: string, finishedAt: string | null) {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}min`;
}

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [inProgress, setInProgress] = useState<AdminRound[]>([]);
  const [completed, setCompleted] = useState<AdminRound[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [s, ip, done] = await Promise.all([
          api.adminRoundStats(),
          api.adminListRounds({ status: 'IN_PROGRESS', limit: 10 }),
          api.adminListRounds({ status: 'COMPLETED', limit: 10 })
        ]);
        if (cancelled) return;
        setStats(s);
        setInProgress(ip);
        setCompleted(done);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Okänt fel');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Översikt av plattformen." />
        <p>Laddar översikt...</p>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Översikt av plattformen." />
        <section className="card">
          <h3>Kunde inte ladda översikten</h3>
          <p style={{ color: '#991b1b' }}>{error}</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Översikt av plattformen — användare och rundor." />

      {/* User stats */}
      <h3 style={{ margin: '16px 0 8px', fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.5 }}>
        Användare
      </h3>
      <div className="card-grid">
        <StatCard label="Totalt" value={stats?.users.total ?? 0} />
        <StatCard label="Aktiva" value={stats?.users.active ?? 0} tone="green" />
        <StatCard label="Admins" value={stats?.users.admins ?? 0} tone="blue" />
      </div>

      {/* Round stats */}
      <h3 style={{ margin: '24px 0 8px', fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.5 }}>
        Rundor
      </h3>
      <div className="card-grid">
        <StatCard label="Totalt rundor" value={stats?.rounds.total ?? 0} />
        <StatCard label="Pågående" value={stats?.rounds.inProgress ?? 0} tone="blue" />
        <StatCard label="Avslutade" value={stats?.rounds.completed ?? 0} tone="green" />
        <StatCard label="Avbrutna" value={stats?.rounds.abandoned ?? 0} tone="red" />
      </div>

      {/* In-progress rounds */}
      <section className="card" style={{ marginTop: 24 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Pågående rundor</h2>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {inProgress.length} senaste
          </span>
        </header>
        {inProgress.length === 0 ? (
          <EmptyState title="Inga pågående rundor" description="När någon spelar visas rundorna här live." />
        ) : (
          <RoundList rounds={inProgress} showDuration />
        )}
      </section>

      {/* Completed rounds */}
      <section className="card" style={{ marginTop: 16 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Senast avslutade rundor</h2>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {completed.length} senaste
          </span>
        </header>
        {completed.length === 0 ? (
          <EmptyState title="Inga avslutade rundor än" description="När rundor avslutas visas de här." />
        ) : (
          <RoundList rounds={completed} showScore />
        )}
      </section>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'blue' | 'red' }) {
  const accent =
    tone === 'green' ? '#16a34a' : tone === 'blue' ? '#2563eb' : tone === 'red' ? '#dc2626' : 'var(--text)';
  return (
    <section className="card" style={{ alignItems: 'flex-start' }}>
      <h3 style={{ margin: 0, fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </h3>
      <strong style={{ fontSize: 32, color: accent, lineHeight: 1 }}>{value.toLocaleString('sv-SE')}</strong>
    </section>
  );
}

function RoundList({ rounds, showDuration, showScore }: { rounds: AdminRound[]; showDuration?: boolean; showScore?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rounds.map((r) => {
        const playerName = r.user.profile?.displayName ?? r.user.email;
        return (
          <div key={r.id} className="list-row static-row" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {playerName}
              </strong>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {r.clubNameSnapshot} · {r.courseNameSnapshot}
                {r._count.players > 1 ? ` · ${r._count.players} spelare` : ''}
              </span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {showDuration ? (
                <>Hål {r.currentHoleNumber} · {formatDuration(r.startedAt, r.finishedAt)}</>
              ) : showScore && r.totalScore !== null ? (
                <>Score: {r.totalScore}</>
              ) : (
                formatDate(r.startedAt)
              )}
            </span>
            <EntityStatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
          </div>
        );
      })}
    </div>
  );
}
