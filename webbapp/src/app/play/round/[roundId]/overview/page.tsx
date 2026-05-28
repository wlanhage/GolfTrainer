'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Camera, ChevronDown } from 'lucide-react';
import { useRoundsApi, type ServerRoundDetail, type ServerRoundHole, type ServerRoundPlayer } from '@/lib/api';
import { useT } from '@/lib/i18n/I18nProvider';
import { Loader } from '@/components/Loader';
import { UserAvatar } from '@/components/UserAvatar';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function relativeLabel(diff: number): string {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/** CSS classes for a score cell based on strokes vs par. */
function scoreCellClasses(strokes: number | null, par: number | null): string {
  if (strokes === null || par === null) return '';
  const diff = strokes - par;
  if (diff >= 2) return 'bg-blue-600 text-white rounded-md'; // double bogey+
  if (diff === 1) return 'bg-blue-400 text-white rounded-md'; // bogey
  if (diff === -1) return 'bg-red-500 text-white rounded-full'; // birdie
  if (diff <= -2) return 'bg-yellow-500 text-white rounded-full ring-2 ring-yellow-300'; // eagle+
  return ''; // par — no styling
}

function formatLabel(format: string, t: (key: string) => string): string {
  switch (format) {
    case 'STROKE_PLAY': return t('roundOverview.strokePlay');
    case 'STABLEFORD': return t('roundOverview.stableford');
    case 'BEST_BALL_TEAM':
    case 'BEST_BALL_2V2': return t('roundOverview.bestBall');
    case 'WOLF': return t('roundOverview.wolf');
    case 'FFA_STROKE':
    case 'FFA_STABLEFORD': return t('roundOverview.ffa');
    default: return format;
  }
}

// ── derived data per player ───────────────────────────────────────────────────

interface PlayerScorecard {
  player: ServerRoundPlayer;
  /** holes in order */
  holes: ServerRoundHole[];
  totalBrutto: number;
  totalPar: number;
  holesPlayed: number;
  hasHcpData: boolean;
}

function buildScorecard(
  player: ServerRoundPlayer,
  roundHoles: ServerRoundHole[]
): PlayerScorecard {
  const sorted = [...roundHoles].sort((a, b) => a.holeNumber - b.holeNumber);

  let totalBrutto = 0;
  let totalPar = 0;
  let holesPlayed = 0;
  let hasHcpData = false;

  for (const hole of sorted) {
    const score = hole.scores?.find((s) => s.playerId === player.id);
    const strokes = score?.strokes ?? null;
    if (strokes !== null) {
      totalBrutto += strokes;
      holesPlayed += 1;
      if (hole.parSnapshot !== null) totalPar += hole.parSnapshot;
    }
    if (hole.hcpIndexSnapshot !== null) hasHcpData = true;
  }

  return { player, holes: sorted, totalBrutto, totalPar, holesPlayed, hasHcpData };
}

// ── scorecard table ───────────────────────────────────────────────────────────

function ScorecardTable({ player, holes, showHcp, t }: {
  player: ServerRoundPlayer;
  holes: ServerRoundHole[];
  showHcp: boolean;
  t: (key: string) => string;
}) {
  const is18 = holes.length > 9;
  const firstNine = holes.slice(0, 9);
  const secondNine = is18 ? holes.slice(9, 18) : [];

  const sumPar = (hs: ServerRoundHole[]) => hs.reduce((s, h) => s + (h.parSnapshot ?? 0), 0);
  const sumStrokes = (hs: ServerRoundHole[]) =>
    hs.reduce((s, h) => {
      const score = h.scores?.find((sc) => sc.playerId === player.id);
      return s + (score?.strokes ?? 0);
    }, 0);

  const outPar = sumPar(firstNine);
  const outStrokes = sumStrokes(firstNine);
  const inPar = is18 ? sumPar(secondNine) : null;
  const inStrokes = is18 ? sumStrokes(secondNine) : null;
  const totPar = is18 ? outPar + (inPar ?? 0) : outPar;
  const totStrokes = is18 ? outStrokes + (inStrokes ?? 0) : outStrokes;

  const headerBg = 'bg-slate-100';
  const subtotalBg = 'bg-slate-50';

  const renderSection = (
    hs: ServerRoundHole[],
    section: 'out' | 'in',
    sectionPar: number,
    sectionStrokes: number,
    showTotal: boolean,
  ) => (
    <tbody>
      {/* Hole numbers row */}
      <tr className={headerBg}>
        <td className="px-2 py-1 text-sm font-bold text-slate-500 whitespace-nowrap">
          {t('roundOverview.hole')}
        </td>
        {hs.map((hole) => (
          <td key={hole.holeNumber} className="px-1 py-1 text-center text-sm">
            {hole.holeNumber}
          </td>
        ))}
        <td className={`px-1 py-1 text-center text-sm font-bold border-l border-border ${subtotalBg}`}>
          {section === 'out' ? t('roundOverview.out') : t('roundOverview.in')}
        </td>
        {showTotal && (
          <td className={`px-1 py-1 text-center text-sm font-bold border-l border-border ${subtotalBg}`}>
            {t('roundOverview.total')}
          </td>
        )}
      </tr>

      {/* HCP index row */}
      {showHcp && (
        <tr>
          <td className="px-2 py-1 text-sm text-slate-500 whitespace-nowrap">
            {t('roundOverview.handicap')}
          </td>
          {hs.map((hole) => (
            <td key={hole.holeNumber} className="px-1 py-1 text-center text-sm text-slate-500">
              {hole.hcpIndexSnapshot ?? '-'}
            </td>
          ))}
          <td className={`px-1 py-1 text-center text-sm border-l border-border ${subtotalBg}`} />
          {showTotal && <td className={`border-l border-border ${subtotalBg}`} />}
        </tr>
      )}

      {/* Par row */}
      <tr>
        <td className="px-2 py-1 text-sm font-semibold text-slate-600 whitespace-nowrap">
          {t('roundOverview.par')}
        </td>
        {hs.map((hole) => (
          <td key={hole.holeNumber} className="px-1 py-1 text-center text-sm">
            {hole.parSnapshot ?? '-'}
          </td>
        ))}
        <td className={`px-1 py-1 text-center text-sm font-bold border-l border-border ${subtotalBg}`}>
          {sectionPar > 0 ? sectionPar : '-'}
        </td>
        {showTotal && (
          <td className={`px-1 py-1 text-center text-sm font-bold border-l border-border ${subtotalBg}`}>
            {totPar > 0 ? totPar : '-'}
          </td>
        )}
      </tr>

      {/* Result row */}
      <tr className="border-t border-border">
        <td className="px-2 py-1 text-sm font-semibold text-slate-600 whitespace-nowrap">
          {t('roundOverview.result')}
        </td>
        {hs.map((hole) => {
          const score = hole.scores?.find((s) => s.playerId === player.id);
          const strokes = score?.strokes ?? null;
          const cellClasses = scoreCellClasses(strokes, hole.parSnapshot);
          return (
            <td key={hole.holeNumber} className="px-0.5 py-1 text-center">
              {strokes !== null ? (
                <span className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold ${cellClasses}`}>
                  {strokes}
                </span>
              ) : (
                <span className="text-sm text-slate-400">-</span>
              )}
            </td>
          );
        })}
        <td className={`px-1 py-1 text-center text-sm font-bold border-l border-border ${subtotalBg}`}>
          {sectionStrokes > 0 ? sectionStrokes : '-'}
        </td>
        {showTotal && (
          <td className={`px-1 py-1 text-center text-sm font-bold border-l border-border ${subtotalBg}`}>
            {totStrokes > 0 ? totStrokes : '-'}
          </td>
        )}
      </tr>
    </tbody>
  );

  const renderTable = (
    hs: ServerRoundHole[],
    section: 'out' | 'in',
    sectionPar: number,
    sectionStrokes: number,
    showTotal: boolean,
  ) => (
    <table className="w-full border-collapse text-ink">
      <colgroup>
        <col className="w-16" />
        {hs.map((_, i) => <col key={i} />)}
        <col className="w-12" />
        {showTotal ? <col className="w-12" /> : null}
      </colgroup>
      {renderSection(hs, section, sectionPar, sectionStrokes, showTotal)}
    </table>
  );

  return (
    <div className="flex flex-col gap-2 -mx-4 px-4">
      {renderTable(firstNine, 'out', outPar, outStrokes, false)}
      {is18 && secondNine.length > 0 &&
        renderTable(secondNine, 'in', inPar ?? 0, inStrokes ?? 0, true)
      }
    </div>
  );
}

// ── player card ───────────────────────────────────────────────────────────────

function PlayerCard({
  scorecard,
  position,
  defaultOpen,
  t,
}: {
  scorecard: PlayerScorecard;
  position: number;
  defaultOpen: boolean;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { player, holes, totalBrutto, totalPar, holesPlayed, hasHcpData } = scorecard;
  const relDiff = holesPlayed > 0 ? totalBrutto - totalPar : null;

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        {/* Position badge */}
        <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-extrabold flex items-center justify-center">
          {position}
        </span>

        {/* Avatar + name */}
        <UserAvatar displayName={player.displayNameSnapshot} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink truncate leading-tight">{player.displayNameSnapshot}</p>
          <p className="text-xs text-slate-500">
            {holesPlayed} {t('roundOverview.holesPlayed')}
          </p>
        </div>

        {/* Score + relative to par */}
        <div className="shrink-0 text-right mr-2">
          <p className="text-2xl font-extrabold text-primary leading-none">
            {holesPlayed > 0 ? totalBrutto : '-'}
          </p>
          {relDiff !== null && (
            <p className={`text-xs font-bold ${relDiff > 0 ? 'text-blue-600' : relDiff < 0 ? 'text-red-500' : 'text-slate-500'}`}>
              {relativeLabel(relDiff)}
            </p>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Expanded scorecard */}
      {open && (
        <div className="border-t border-border px-4 py-3">
          <ScorecardTable
            player={player}
            holes={holes}
            showHcp={hasHcpData}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function RoundOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = String(params?.roundId ?? '');
  const roundsApi = useRoundsApi();
  const t = useT();

  const [round, setRound] = useState<ServerRoundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    if (!roundId) return;
    let active = true;
    setLoading(true);
    // Try public endpoint first (works for any round), fall back to private
    roundsApi
      .getByIdPublic(roundId)
      .catch(() => roundsApi.getById(roundId))
      .then((data) => {
        if (!active) return;
        if (!data) {
          setNotFound(true);
        } else {
          setRound(data);
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roundId, roundsApi]);

  if (loading) return <Loader label={t('roundOverview.loading')} />;

  if (notFound || !round) {
    return (
      <div className="p-6 flex flex-col items-center gap-4">
        <p className="text-slate-600">{t('roundOverview.notFound')}</p>
        <button
          onClick={() => router.back()}
          className="text-primary font-semibold text-sm"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  // Sort players by order; fall back to index
  const sortedPlayers = [...(round.players ?? [])].sort((a, b) => a.order - b.order);

  // Build scorecards
  const scorecards = sortedPlayers.map((p) => buildScorecard(p, round.roundHoles ?? []));

  // Sort by total brutto ascending for position ranking
  const ranked = [...scorecards].sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
    if (a.holesPlayed === 0) return 1;
    if (b.holesPlayed === 0) return -1;
    return a.totalBrutto - b.totalBrutto;
  });
  const positionMap = new Map(ranked.map((sc, i) => [sc.player.id, i + 1]));

  const dateStr = formatDate(round.startedAt);
  const formatStr = formatLabel(round.format, t);

  return (
    <div className="flex flex-col gap-4 pb-24 pt-4 px-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="self-start flex items-center gap-1 text-sm text-primary font-semibold -ml-1"
        aria-label={t('common.back')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        {t('common.back')}
      </button>

      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h1 className="text-2xl font-extrabold text-ink leading-tight">{round.courseNameSnapshot}</h1>
          <p className="text-sm text-slate-500">
            {round.clubNameSnapshot}
            {round.teeNameSnapshot ? ` · ${round.teeNameSnapshot}` : ''}
          </p>
          <p className="text-sm text-slate-500">
            {dateStr} · {formatStr}
          </p>
        </div>
        {round.image ? (
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            aria-label="Visa bild från rundan"
            className="shrink-0 w-10 h-10 rounded-full bg-primary-softer border border-primary/30 flex items-center justify-center text-primary"
          >
            <Camera size={20} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {/* If no players, show a simple fallback */}
      {sortedPlayers.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-4 text-center text-slate-600 text-sm">
          Inga spelare registrerade.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {scorecards.map((sc, idx) => (
            <PlayerCard
              key={sc.player.id}
              scorecard={sc}
              position={positionMap.get(sc.player.id) ?? idx + 1}
              // First player (host) starts expanded by default
              defaultOpen={idx === 0}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Continue playing link if round is still in progress */}
      {round.status === 'IN_PROGRESS' && (
        <Link
          href={`/play/round/${roundId}/${round.currentHoleNumber}`}
          className="mt-2 block w-full bg-primary text-white rounded-2xl py-3 text-center font-bold text-base"
        >
          Fortsätt runda · Hål {round.currentHoleNumber}
        </Link>
      )}

      {imageOpen && round.image ? (
        <div
          className="fixed inset-0 z-50 bg-slate-900/90 flex items-center justify-center p-4"
          onClick={() => setImageOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={round.image} alt="Bild från rundan" className="max-w-full max-h-full rounded-2xl" />
        </div>
      ) : null}
    </div>
  );
}
