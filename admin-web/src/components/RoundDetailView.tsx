'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { RoundDetail, RoundPlayer, RoundStatus } from '../lib/types';
import { EntityStatusBadge } from './common/EntityStatusBadge';
import { PageHeader } from './common/PageHeader';

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(start: string, end: string | null) {
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  const m = Math.max(0, Math.round((b - a) / 60000));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export function RoundDetailView() {
  const params = useParams<{ roundId: string }>();
  const [round, setRound] = useState<RoundDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // forces duration recompute

  // Auto-refresh in-progress rounds every 10s so admin sees live updates
  useEffect(() => {
    if (round?.status !== 'IN_PROGRESS') return;
    const id = setInterval(() => {
      api.getRound(params.roundId).then(setRound).catch(() => {});
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(id);
  }, [round?.status, params.roundId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await api.getRound(params.roundId);
        if (!cancelled) setRound(r);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Okänt fel');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.roundId]);

  // Order: host first, then by order
  const sortedPlayers = useMemo(() => {
    if (!round) return [];
    return [...round.players].sort((a, b) => (a.isHost ? -1 : b.isHost ? 1 : a.order - b.order));
  }, [round]);

  // Build a hole-by-player score grid
  const grid = useMemo(() => {
    if (!round) return { holes: [], rows: [] as Array<{ player: RoundPlayer; scores: (number | null)[]; total: number; relToPar: number }> };
    const holes = [...round.roundHoles].sort((a, b) => a.holeNumber - b.holeNumber);
    const parTotal = holes.reduce((sum, h) => sum + (h.parSnapshot ?? 0), 0);
    const rows = sortedPlayers.map((p) => {
      const scores = holes.map((h) => h.scores.find((s) => s.playerId === p.id)?.strokes ?? null);
      const playedHoles = holes.filter((_, idx) => scores[idx] !== null);
      const playedPar = playedHoles.reduce((sum, h) => sum + (h.parSnapshot ?? 0), 0);
      const total = scores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
      const relToPar = total - playedPar;
      return { player: p, scores, total, relToPar };
    });
    return { holes, rows, parTotal };
  }, [round, sortedPlayers]);

  if (loading) {
    return (
      <>
        <PageHeader title="Laddar runda..." description="" />
      </>
    );
  }

  if (error || !round) {
    return (
      <>
        <PageHeader title="Runda hittades inte" description={error ?? 'Okänt fel'} />
        <p>
          <Link href="/dashboard" style={{ color: '#0f766e' }}>← Tillbaka till översikt</Link>
        </p>
      </>
    );
  }

  const hostName =
    round.players.find((p) => p.isHost)?.displayNameSnapshot ?? sortedPlayers[0]?.displayNameSnapshot ?? '—';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/dashboard" style={{ color: 'var(--muted)', fontSize: 13 }}>← Översikt</Link>
        <EntityStatusBadge label={STATUS_LABEL[round.status]} tone={STATUS_TONE[round.status]} />
        {round.status === 'IN_PROGRESS' ? (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16a34a', marginRight: 6, animation: 'pulse 1.6s ease-in-out infinite' }} />
            Live · uppdateras var 10 s
          </span>
        ) : null}
      </div>

      <PageHeader
        title={`${round.clubNameSnapshot} · ${round.courseNameSnapshot}`}
        description={`Host: ${hostName}${round.teeNameSnapshot ? ` · Tee: ${round.teeNameSnapshot}` : ''}`}
      />

      {/* Quick meta */}
      <div className="card-grid">
        <MetaCard label="Startade" value={formatDateTime(round.startedAt)} />
        {round.status === 'IN_PROGRESS' ? (
          <MetaCard label="Hål just nu" value={`${round.currentHoleNumber} / ${grid.holes.length}`} accent="#2563eb" />
        ) : round.finishedAt ? (
          <MetaCard label="Avslutades" value={formatDateTime(round.finishedAt)} />
        ) : null}
        <MetaCard label="Speltid" value={formatDuration(round.startedAt, round.finishedAt) + (tick >= 0 ? '' : '')} />
        <MetaCard label="Format" value={round.format.replace(/_/g, ' ')} />
      </div>

      {/* Players summary */}
      <section className="card" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Spelare ({sortedPlayers.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {grid.rows.map(({ player, total, relToPar, scores }) => {
            const completed = scores.filter((s) => s !== null).length;
            return (
              <div key={player.id} className="list-row static-row" style={{ alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <strong>
                    {player.displayNameSnapshot}
                    {player.isHost ? <span style={{ marginLeft: 6, color: '#2563eb', fontSize: 11, fontWeight: 600 }}>HOST</span> : null}
                    {player.leftAt ? <span style={{ marginLeft: 6, color: '#dc2626', fontSize: 11 }}>LÄMNAT</span> : null}
                  </strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {completed} / {grid.holes.length} hål spelade
                    {player.team ? ` · Lag ${player.team}` : ''}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Total</span>
                <strong style={{ fontSize: 18 }}>
                  {total}
                  <span style={{ marginLeft: 6, fontSize: 12, color: relToPar > 0 ? '#dc2626' : relToPar < 0 ? '#16a34a' : 'var(--muted)' }}>
                    {relToPar === 0 ? 'E' : relToPar > 0 ? `+${relToPar}` : relToPar}
                  </span>
                </strong>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scorecard */}
      <section className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <h2 style={{ margin: 0 }}>Scorekort</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px', position: 'sticky', left: 0, background: 'var(--card)' }}>Hål</th>
              {grid.holes.map((h) => (
                <th
                  key={h.id}
                  style={{
                    textAlign: 'center',
                    padding: '8px 6px',
                    minWidth: 38,
                    background: h.holeNumber === round.currentHoleNumber && round.status === 'IN_PROGRESS' ? '#dbeafe' : undefined
                  }}
                >
                  {h.holeNumber}
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '8px 6px', borderLeft: '1px solid var(--border)' }}>Sum</th>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 400 }}>
              <td style={{ padding: '6px', position: 'sticky', left: 0, background: 'var(--card)' }}>Par</td>
              {grid.holes.map((h) => (
                <td key={h.id} style={{ textAlign: 'center', padding: '6px' }}>{h.parSnapshot ?? '—'}</td>
              ))}
              <td style={{ textAlign: 'center', padding: '6px', borderLeft: '1px solid var(--border)' }}>{grid.parTotal ?? '—'}</td>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map(({ player, scores, total }) => (
              <tr key={player.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 6px', position: 'sticky', left: 0, background: 'var(--card)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {player.displayNameSnapshot}
                </td>
                {scores.map((s, idx) => {
                  const par = grid.holes[idx].parSnapshot;
                  const diff = s !== null && par !== null ? s - par : null;
                  let bg: string | undefined;
                  if (diff !== null) {
                    if (diff <= -2) bg = '#fef3c7'; // eagle/better
                    else if (diff === -1) bg = '#dcfce7'; // birdie
                    else if (diff === 0) bg = undefined; // par
                    else if (diff === 1) bg = '#fee2e2'; // bogey
                    else if (diff >= 2) bg = '#fecaca'; // double+
                  }
                  return (
                    <td
                      key={grid.holes[idx].id}
                      style={{ textAlign: 'center', padding: '6px', background: bg, fontWeight: s !== null ? 600 : 400, color: s === null ? 'var(--muted)' : undefined }}
                    >
                      {s ?? '–'}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', padding: '6px', borderLeft: '1px solid var(--border)', fontWeight: 700 }}>
                  {total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <Legend bg="#fef3c7" label="Eagle eller bättre" />
          <Legend bg="#dcfce7" label="Birdie" />
          <Legend bg="transparent" label="Par" />
          <Legend bg="#fee2e2" label="Bogey" />
          <Legend bg="#fecaca" label="Double+" />
        </div>
      </section>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}

function MetaCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <section className="card" style={{ alignItems: 'flex-start' }}>
      <h3 style={{ margin: 0, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</h3>
      <strong style={{ fontSize: 18, color: accent ?? 'var(--text)' }}>{value}</strong>
    </section>
  );
}

function Legend({ bg, label }: { bg: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-block', width: 12, height: 12, background: bg, border: '1px solid var(--border)', borderRadius: 3 }} />
      {label}
    </span>
  );
}
