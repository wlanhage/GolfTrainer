'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Home, LayoutGrid, Trophy } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { useRoundsApi, type ServerRoundDetail, type ServerRoundHole, type ServerRoundPlayer } from '@/lib/api';
import { useToast } from '@/lib/ToastProvider';
import { Loader } from '@/components/Loader';
import { UserAvatar } from '@/components/UserAvatar';
import { stablefordPoints } from '@/lib/scoring';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function compressImage(file: File, maxSize = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Kunde inte läsa filen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Kunde inte avkoda bilden'));
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D saknas'));
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function formatDuration(startedAt: string, finishedAt: string | null): string | null {
  if (!finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function relativeLabel(diff: number): string {
  if (diff === 0) return 'EVEN';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

const playerLabel = (p: ServerRoundPlayer): string =>
  p.user?.isGuest ? `${p.displayNameSnapshot} (Gäst)` : p.displayNameSnapshot;

function formatLabel(format: string): string {
  switch (format) {
    case 'STROKE_PLAY': return 'Slagtävling';
    case 'STABLEFORD': return 'Poängbogey';
    case 'BEST_BALL_TEAM':
    case 'BEST_BALL_2V2': return 'Bästboll';
    case 'WOLF': return 'Wolf';
    case 'FFA_STROKE':
    case 'FFA_STABLEFORD': return 'Alla mot alla';
    default: return format;
  }
}

type PlayerStats = {
  player: ServerRoundPlayer;
  totalStrokes: number;
  totalPar: number;
  relativeToPar: number | null;
  stableford: number;
  holesPlayed: number;
  // counts vs par
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublesPlus: number;
};

function buildStats(player: ServerRoundPlayer, holes: ServerRoundHole[]): PlayerStats {
  let totalStrokes = 0;
  let totalPar = 0;
  let stableford = 0;
  let holesPlayed = 0;
  let eagles = 0;
  let birdies = 0;
  let pars = 0;
  let bogeys = 0;
  let doublesPlus = 0;

  for (const hole of holes) {
    const score = hole.scores?.find((s) => s.playerId === player.id);
    const strokes = score?.strokes ?? null;
    if (strokes === null) continue;
    holesPlayed += 1;
    totalStrokes += strokes;
    if (hole.parSnapshot !== null) {
      totalPar += hole.parSnapshot;
      const diff = strokes - hole.parSnapshot;
      if (diff <= -2) eagles += 1;
      else if (diff === -1) birdies += 1;
      else if (diff === 0) pars += 1;
      else if (diff === 1) bogeys += 1;
      else doublesPlus += 1;
      stableford += stablefordPoints(strokes, hole.parSnapshot) ?? 0;
    }
  }

  return {
    player,
    totalStrokes,
    totalPar,
    relativeToPar: totalPar > 0 ? totalStrokes - totalPar : null,
    stableford,
    holesPlayed,
    eagles,
    birdies,
    pars,
    bogeys,
    doublesPlus
  };
}

export default function RoundSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = String(params?.roundId ?? '');
  const roundsApi = useRoundsApi();
  const { me } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [round, setRound] = useState<ServerRoundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPersonalBest, setIsPersonalBest] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    if (!roundId) return;
    let active = true;
    roundsApi
      .getByIdPublic(roundId)
      .catch(() => roundsApi.getById(roundId))
      .then((data) => {
        if (!active) return;
        if (!data) setNotFound(true);
        else setRound(data);
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

  // Detect personal best: among current user's COMPLETED rounds on same course,
  // is this round the lowest totalScore?
  useEffect(() => {
    if (!round || round.status !== 'COMPLETED' || !me?.id) return;
    if (round.userId !== me.id) return;
    if (round.totalScore == null) return;
    let active = true;
    roundsApi
      .list('COMPLETED')
      .then((rs) => {
        if (!active) return;
        const sameCourse = rs.filter(
          (r) => r.courseId === round.courseId && r.id !== round.id && r.totalScore != null
        );
        const bestOther = sameCourse.reduce<number | null>((min, r) => {
          if (r.totalScore == null) return min;
          if (min === null || r.totalScore < min) return r.totalScore;
          return min;
        }, null);
        if (bestOther === null || (round.totalScore !== null && round.totalScore < bestOther)) {
          setIsPersonalBest(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [round, me, roundsApi]);

  const stats = useMemo(() => {
    if (!round) return [] as PlayerStats[];
    return (round.players ?? []).map((p) => buildStats(p, round.roundHoles ?? []));
  }, [round]);

  const ranked = useMemo(() => {
    if (stats.length === 0) return [] as PlayerStats[];
    return [...stats].sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
      if (a.holesPlayed === 0) return 1;
      if (b.holesPlayed === 0) return -1;
      return a.totalStrokes - b.totalStrokes;
    });
  }, [stats]);

  const viewerStats = useMemo(() => {
    if (!me || stats.length === 0) return null;
    return stats.find((s) => s.player.userId === me.id) ?? null;
  }, [stats, me]);

  // If viewer isn't a player (rare), fall back to the host as the hero.
  const heroStats = viewerStats ?? ranked[0] ?? null;
  const others = useMemo(
    () => ranked.filter((s) => s.player.id !== heroStats?.player.id),
    [ranked, heroStats]
  );

  const heroPosition = heroStats ? ranked.findIndex((s) => s.player.id === heroStats.player.id) + 1 : 0;
  const isHost = !!(me?.id && round?.userId === me.id);
  const canUpload = isHost && round?.image == null;

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !round) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Filen är inte en bild.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Filen är för stor (max 10 MB).');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      const updated = await roundsApi.setImage(round.id, dataUrl);
      setRound(updated);
      toast.success('Bild sparad.');
    } catch (err) {
      toast.error(`Kunde inte spara bilden: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loader label="Laddar runda" />;
  if (notFound || !round) {
    return (
      <div className="p-6 flex flex-col items-center gap-4">
        <p className="text-slate-600">Rundan hittades inte.</p>
        <button onClick={() => router.push('/')} className="text-primary font-semibold text-sm">
          Tillbaka till start
        </button>
      </div>
    );
  }

  const duration = formatDuration(round.startedAt, round.finishedAt);
  const dateStr = new Date(round.startedAt).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 pt-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-primary font-semibold text-sm" aria-label="Hem">
          ‹ Hem
        </Link>
        <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Runda klar</span>
        <span className="w-12" />
      </div>

      {/* Header */}
      <header className="text-center flex flex-col gap-0.5">
        <h1 className="text-3xl font-extrabold text-ink leading-tight">{round.courseNameSnapshot}</h1>
        <p className="text-sm text-slate-500">
          {round.clubNameSnapshot}
          {round.teeNameSnapshot ? ` · ${round.teeNameSnapshot}` : ''}
        </p>
        <p className="text-sm text-slate-500">
          {dateStr} · {formatLabel(round.format)}
        </p>
      </header>

      {/* Hero card — viewer-as-hero */}
      {heroStats ? (
        <section className="bg-primary-softer border-2 border-primary/30 rounded-3xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar displayName={heroStats.player.displayNameSnapshot} size={56} />
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-ink text-lg truncate">
                {playerLabel(heroStats.player)}
              </p>
              <p className="text-xs text-slate-600">
                {ranked.length > 1 ? `Plats ${heroPosition} av ${ranked.length}` : 'Solo runda'}
              </p>
            </div>
          </div>

          <div className="flex items-baseline justify-center gap-4">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider font-bold text-primary">Slag</div>
              <div className="text-5xl font-extrabold text-primary leading-none">
                {heroStats.holesPlayed > 0 ? heroStats.totalStrokes : '—'}
              </div>
            </div>
            {heroStats.relativeToPar !== null ? (
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-wider font-bold text-primary">Mot par</div>
                <div className="text-5xl font-extrabold text-ink leading-none">
                  {relativeLabel(heroStats.relativeToPar)}
                </div>
              </div>
            ) : null}
            {(round.format === 'STABLEFORD' || round.format === 'FFA_STABLEFORD') && heroStats.holesPlayed > 0 ? (
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-wider font-bold text-primary">Poäng</div>
                <div className="text-5xl font-extrabold text-ink leading-none">{heroStats.stableford}</div>
              </div>
            ) : null}
          </div>

          {heroStats.holesPlayed > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {heroStats.eagles > 0 ? (
                <span className="bg-yellow-100 text-yellow-800 font-bold px-2.5 py-1 rounded-full">
                  {heroStats.eagles} eagle+
                </span>
              ) : null}
              {heroStats.birdies > 0 ? (
                <span className="bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full">
                  {heroStats.birdies} birdie
                </span>
              ) : null}
              {heroStats.pars > 0 ? (
                <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full">
                  {heroStats.pars} par
                </span>
              ) : null}
              {heroStats.bogeys > 0 ? (
                <span className="bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                  {heroStats.bogeys} bogey
                </span>
              ) : null}
              {heroStats.doublesPlus > 0 ? (
                <span className="bg-blue-200 text-blue-900 font-bold px-2.5 py-1 rounded-full">
                  {heroStats.doublesPlus} dbl+
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-4 text-xs text-slate-600">
            <span>
              {heroStats.holesPlayed} av {round.roundHoles?.length ?? 0} hål spelade
            </span>
            {duration ? <span>· {duration}</span> : null}
          </div>
        </section>
      ) : null}

      {/* Personal best */}
      {isPersonalBest ? (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <Trophy className="text-amber-600 shrink-0" size={28} aria-hidden="true" />
          <div>
            <p className="font-extrabold text-amber-900">Personligt rekord!</p>
            <p className="text-xs text-amber-800">Du har aldrig spelat bättre på den här banan.</p>
          </div>
        </div>
      ) : null}

      {/* Other players */}
      {others.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Övriga spelare</h2>
          <div className="bg-white border border-border rounded-2xl divide-y divide-slate-100">
            {others.map((s) => {
              const pos = ranked.findIndex((x) => x.player.id === s.player.id) + 1;
              return (
                <div key={s.player.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-6 text-center text-sm font-bold text-slate-500">#{pos}</span>
                  <UserAvatar displayName={s.player.displayNameSnapshot} size={32} />
                  <span className="flex-1 font-bold text-ink truncate">
                    {playerLabel(s.player)}
                  </span>
                  <span className="text-lg font-extrabold text-ink">
                    {s.holesPlayed > 0 ? s.totalStrokes : '—'}
                  </span>
                  {s.relativeToPar !== null ? (
                    <span
                      className={`text-xs font-bold w-10 text-right ${
                        s.relativeToPar > 0
                          ? 'text-blue-600'
                          : s.relativeToPar < 0
                            ? 'text-red-500'
                            : 'text-slate-500'
                      }`}
                    >
                      {relativeLabel(s.relativeToPar)}
                    </span>
                  ) : (
                    <span className="w-10" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Image: existing or upload */}
      {round.image ? (
        <button
          type="button"
          onClick={() => setImageOpen(true)}
          className="block w-full overflow-hidden rounded-2xl border border-border"
          aria-label="Visa bilden i fullskärm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={round.image} alt="Bild från rundan" className="w-full h-auto block" />
        </button>
      ) : canUpload ? (
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPickImage(e)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-white border-2 border-dashed border-primary text-primary rounded-2xl px-4 py-6 flex flex-col items-center justify-center gap-2 font-bold disabled:opacity-50"
          >
            <Camera size={28} aria-hidden="true" />
            <span>{uploading ? 'Laddar upp…' : 'Lägg till bild från rundan'}</span>
            <span className="text-xs font-normal text-slate-500">Öl, vädret, gänget — vad du vill</span>
          </button>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-2">
        {me?.isGuest ? (
          <>
            <Link
              href={`/register/claim?roundId=${round.id}`}
              className="btn-primary flex items-center justify-center gap-2"
            >
              Registrera och spara rundan
            </Link>
            <p className="text-xs text-slate-500 text-center">
              Utan konto försvinner rundan från dig när du lämnar — dina medspelare
              behåller dina scores.
            </p>
            <Link href={`/play/round/${round.id}/overview`} className="btn-ghost flex items-center justify-center gap-2">
              <LayoutGrid size={18} aria-hidden="true" />
              Se scorecard
            </Link>
          </>
        ) : (
          <>
            <Link href={`/play/round/${round.id}/overview`} className="btn-primary flex items-center justify-center gap-2">
              <LayoutGrid size={18} aria-hidden="true" />
              Se scorecard
            </Link>
            <Link href="/" className="btn-ghost flex items-center justify-center gap-2">
              <Home size={18} aria-hidden="true" />
              Hem
            </Link>
          </>
        )}
      </div>

      {/* Image lightbox */}
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
