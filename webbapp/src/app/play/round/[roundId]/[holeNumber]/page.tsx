'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCaddyApi, useCoursesApi } from '@/lib/api';
import { useRoundsStore } from '@/lib/roundsStore';
import type { ServerRoundHole, ServerRoundHoleScore, ServerRoundPlayer, ServerWolfRole } from '@/lib/api';
import { useRoundsApi } from '@/lib/api';
import { stablefordPoints } from '@/lib/scoring';
import { GroupScoreBoard } from '@/components/play/GroupScoreBoard';
import { ScoreChipBar } from '@/components/play/ScoreChipBar';
import { ScorePadSheet } from '@/components/play/ScorePadSheet';
import { GroupControlBar } from '@/components/round-hole/GroupControlBar';
import { caddyClubs } from '@/lib/caddyClubs';
import { getDistanceToGreenMeters, resolveHeatmapBearing } from '@/lib/holeGeometry';
import { HEATMAP_BIN_SIZE_METERS, HEATMAP_GRID_SIZE } from '@/lib/heatmapConfig';
import { useHeatmapAuto } from '@/lib/heatmapAutoStore';
import { recommendClub } from '@/lib/clubRecommender';
import { useToast } from '@/lib/ToastProvider';
import { parseStrokes } from '@/lib/validation';
import type { CaddyClubSummary, CaddyShot, GeoPoint, HoleLayoutGeometry, Round } from '@/lib/types';
import type { CaddyMapHeatmap } from '@/components/HolePlayMap';
import { BackButton } from '@/components/round-hole/BackButton';
import { HoleHeader } from '@/components/round-hole/HoleHeader';
import { TopRightFabs } from '@/components/round-hole/TopRightFabs';
import { HeatmapRail } from '@/components/round-hole/HeatmapRail';
import { RoundControlBar } from '@/components/round-hole/RoundControlBar';
import { HoleSettingsSheet } from '@/components/round-hole/HoleSettingsSheet';
import { Loader } from '@/components/Loader';

const HolePlayMap = dynamic(() => import('@/components/HolePlayMap').then((m) => m.HolePlayMap), { ssr: false });

export default function RoundHolePage() {
  const params = useParams();
  const router = useRouter();
  const roundId = String(params?.roundId ?? '');
  const holeNumber = Number(params?.holeNumber ?? 1);

  const coursesApi = useCoursesApi();
  const caddyApi = useCaddyApi();
  const roundsApi = useRoundsApi();
  const roundsStore = useRoundsStore();
  const toast = useToast();

  const [round, setRound] = useState<Round | null>(null);
  const [roundHole, setRoundHole] = useState<ServerRoundHole | null>(null);
  const [players, setPlayers] = useState<ServerRoundPlayer[]>([]);
  const [scoresByPlayer, setScoresByPlayer] = useState<Map<string, ServerRoundHoleScore>>(new Map());
  const [scorePadPlayerId, setScorePadPlayerId] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [maxHole, setMaxHole] = useState(18);
  const [layout, setLayout] = useState<HoleLayoutGeometry | null>(null);
  const [score, setScore] = useState('');
  const [playerPosition, setPlayerPosition] = useState<GeoPoint | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState('driver');
  const [caddySummaries, setCaddySummaries] = useState<CaddyClubSummary[]>([]);
  const [heatmapShots, setHeatmapShots] = useState<CaddyShot[]>([]);
  const [shotsByClub, setShotsByClub] = useState<Map<string, CaddyShot[]>>(new Map());
  const [courseId, setCourseId] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState(false);

  const { enabled: autoEnabled, setEnabled: setAutoEnabled } = useHeatmapAuto();
  const [refreshing, setRefreshing] = useState(false);

  // Refetch:ar runda + hål från backend. Används både för initial-load och
  // för "uppdatera"-knapp + visibility/focus-händelser. Bevarar pågående
  // input genom att inte röra `score`-state om scoreInputDirty är satt.
  const reload = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!roundsStore.ready) return;
      if (!opts.silent) setRefreshing(true);
      try {
        const r = await roundsStore.getRound(roundId);
        if (!r) {
          router.replace('/play');
          return;
        }
        setRound(r.round);
        setMaxHole(r.roundHoles.length);
        setCourseId(r.round.courseId);
        // Defensiv: backend kan vara på en äldre deploy som inte returnerar
        // players/scores — då behandlas rundan som legacy-solo.
        const safePlayers = Array.isArray(r.players) ? r.players : [];
        setPlayers(safePlayers);
        const rh = r.roundHoles.find((x) => x.holeNumber === holeNumber) ?? null;
        setRoundHole(rh);
        if (safePlayers.length <= 1) {
          setScore(rh?.strokes?.toString() ?? '');
        }
        const next = new Map<string, ServerRoundHoleScore>();
        (rh?.scores ?? []).forEach((s) => next.set(s.playerId, s));
        setScoresByPlayer(next);
      } finally {
        if (!opts.silent) setRefreshing(false);
      }
    },
    [roundId, holeNumber, roundsStore, router]
  );

  // Initial-load + reload när hål-nummer byts
  useEffect(() => {
    let active = true;
    void (async () => {
      await reload({ silent: true });
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  // Auto-refetch när användaren kommer tillbaka till appen (lock/unlock,
  // tab-switch). Använder silent så vi inte blinkar refresh-spinnern.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload({ silent: true });
    };
    const onFocus = () => void reload({ silent: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [reload]);

  // Ladda bana för aktuell layout
  useEffect(() => {
    if (!courseId) return;
    coursesApi.getCourseDetail(courseId).then((d) => {
      if (!d) return;
      const target = d.holes.find((h) => h.holeNumber === holeNumber);
      setLayout(target?.layout?.geometry ?? null);
    });
  }, [coursesApi, courseId, holeNumber]);

  // GPS — kontinuerlig prenumeration
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPlayerPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPlayerPosition(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Caddy-summaries + slag per klubba (en gång på mount)
  useEffect(() => {
    let active = true;
    void (async () => {
      const summaries = await caddyApi.listClubSummaries();
      if (!active) return;
      setCaddySummaries(summaries);
      const withData = summaries.filter((s) => s.sampleCount > 0).map((s) => s.clubKey);
      const shotsArrays = await Promise.all(withData.map((key) => caddyApi.listShotsForClub(key)));
      if (!active) return;
      const map = new Map<string, CaddyShot[]>();
      withData.forEach((key, i) => map.set(key, shotsArrays[i]));
      setShotsByClub(map);
    })();
    return () => {
      active = false;
    };
  }, [caddyApi]);

  // Slag för aktuellt vald klubba används för heatmap-rendreringen
  useEffect(() => {
    setHeatmapShots(shotsByClub.get(selectedClubId) ?? []);
  }, [shotsByClub, selectedClubId]);

  const distanceToGreen = useMemo(() => {
    if (!layout || !playerPosition) return null;
    return getDistanceToGreenMeters(playerPosition, layout);
  }, [layout, playerPosition]);

  const caddyHeatmap = useMemo<CaddyMapHeatmap | null>(() => {
    if (!heatmapOpen || !layout) return null;
    const bearing = resolveHeatmapBearing(layout, playerPosition);
    const origin = playerPosition ?? layout.teePoint;
    if (bearing === null || !origin || heatmapShots.length === 0) return null;
    const selected = caddySummaries.find((s) => s.clubKey === selectedClubId);
    const centerDistance = selected?.distanceMeters ?? heatmapShots.reduce((s, x) => s + x.distanceMeters, 0) / heatmapShots.length;
    const half = Math.floor(HEATMAP_GRID_SIZE / 2);
    const counts = new Map<string, { lateral: number; forward: number; count: number }>();
    for (const shot of heatmapShots) {
      const lateral = Math.max(-half, Math.min(half, Math.round(shot.lateralOffsetMeters / HEATMAP_BIN_SIZE_METERS)));
      const forward = Math.max(-half, Math.min(half, Math.round((shot.distanceMeters - centerDistance) / HEATMAP_BIN_SIZE_METERS)));
      const id = `${forward}:${lateral}`;
      const cur = counts.get(id);
      counts.set(id, { lateral, forward, count: (cur?.count ?? 0) + 1 });
    }
    const maxCount = Math.max(...Array.from(counts.values()).map((c) => c.count), 1);
    const total = heatmapShots.length;
    return {
      origin,
      bearing,
      cells: Array.from(counts.values()).map((cell) => ({
        id: `${selectedClubId}-${cell.forward}-${cell.lateral}`,
        forwardMeters: centerDistance + cell.forward * HEATMAP_BIN_SIZE_METERS,
        lateralMeters: cell.lateral * HEATMAP_BIN_SIZE_METERS,
        count: cell.count,
        percentage: Math.round((cell.count / total) * 100),
        intensity: cell.count / maxCount
      }))
    };
  }, [caddySummaries, heatmapShots, heatmapOpen, layout, playerPosition, selectedClubId]);

  const heatmapClubsWithData = useMemo(() => {
    const set = new Set(caddySummaries.filter((s) => s.sampleCount > 0).map((s) => s.clubKey));
    return caddyClubs.filter((c) => set.has(c.id));
  }, [caddySummaries]);

  const hasCaddyData = heatmapClubsWithData.length > 0;

  const recommendation = useMemo(() => {
    if (!hasCaddyData) return null;
    return recommendClub({
      summaries: caddySummaries,
      shotsByClub,
      geometry: layout,
      playerPosition
    });
  }, [hasCaddyData, caddySummaries, shotsByClub, layout, playerPosition]);

  // Återställ manuell override vid hål-byte
  useEffect(() => {
    setManualOverride(false);
  }, [holeNumber]);

  // Applicera auto-rekommendation
  useEffect(() => {
    if (!autoEnabled || manualOverride) return;
    if (!recommendation) return;
    setSelectedClubId(recommendation.clubKey);
  }, [autoEnabled, manualOverride, recommendation]);

  // Fallback om vald klubba saknar data
  useEffect(() => {
    if (!heatmapOpen || !hasCaddyData) return;
    if (heatmapClubsWithData.some((c) => c.id === selectedClubId)) return;
    setSelectedClubId(heatmapClubsWithData[0].id);
  }, [heatmapClubsWithData, heatmapOpen, hasCaddyData, selectedClubId]);

  if (!round || !roundHole) {
    return <Loader fullScreen onDark label="Laddar hål" />;
  }

  const isGroup = players.length > 1;
  const format = round?.format ?? 'STROKE_PLAY';
  const isStableford = format === 'STABLEFORD';
  const isWolf = format === 'WOLF';
  const scorePadPlayer = scorePadPlayerId ? players.find((p) => p.id === scorePadPlayerId) ?? null : null;

  const saveAndNext = async () => {
    const parsed = parseStrokes(score);
    if (score.trim() && parsed === null) {
      toast.error('Ange ett heltal som är 0 eller större.');
      return;
    }
    try {
      // Skriv host-spelarens score till RoundHoleScore om vi har players (alla nya rundor)
      const hostPlayer = players[0];
      if (hostPlayer) {
        await roundsApi.updatePlayerScore(roundId, holeNumber, hostPlayer.id, { strokes: parsed });
      } else {
        // Legacy fallback för gamla rundor utan players
        await roundsStore.saveScore(roundId, holeNumber, parsed);
      }
      if (holeNumber >= maxHole) {
        await roundsStore.completeRound(roundId);
        router.replace(`/play/round/${roundId}/overview`);
        return;
      }
      await roundsStore.setCurrentHole(roundId, holeNumber + 1);
      router.replace(`/play/round/${roundId}/${holeNumber + 1}`);
    } catch (e) {
      toast.error(`Kunde inte spara: ${(e as Error).message}`);
    }
  };

  const groupNext = async () => {
    setSavingGroup(true);
    try {
      if (holeNumber >= maxHole) {
        await roundsStore.completeRound(roundId);
        router.replace(`/play/round/${roundId}/overview`);
        return;
      }
      await roundsStore.setCurrentHole(roundId, holeNumber + 1);
      router.replace(`/play/round/${roundId}/${holeNumber + 1}`);
    } catch (e) {
      toast.error(`Kunde inte gå vidare: ${(e as Error).message}`);
    } finally {
      setSavingGroup(false);
    }
  };

  const updatePlayerStrokes = async (playerId: string, strokes: number | null) => {
    // Optimistic update så input känns snabbt
    setScoresByPlayer((prev) => {
      const next = new Map(prev);
      const existing = next.get(playerId);
      next.set(playerId, {
        id: existing?.id ?? `pending-${playerId}`,
        roundHoleId: roundHole?.id ?? '',
        playerId,
        strokes,
        wolfRole: existing?.wolfRole ?? null
      });
      return next;
    });
    try {
      await roundsApi.updatePlayerScore(roundId, holeNumber, playerId, { strokes });
    } catch (e) {
      toast.error(`Kunde inte spara: ${(e as Error).message}`);
    }
  };

  const updatePlayerWolfRole = async (playerId: string, role: ServerWolfRole | null) => {
    setScoresByPlayer((prev) => {
      const next = new Map(prev);
      const existing = next.get(playerId);
      next.set(playerId, {
        id: existing?.id ?? `pending-${playerId}`,
        roundHoleId: roundHole?.id ?? '',
        playerId,
        strokes: existing?.strokes ?? null,
        wolfRole: role
      });
      return next;
    });
    try {
      await roundsApi.updatePlayerScore(roundId, holeNumber, playerId, { wolfRole: role });
    } catch (e) {
      toast.error(`Kunde inte spara: ${(e as Error).message}`);
    }
  };

  const soloPoints = isStableford ? stablefordPoints(parseStrokes(score), roundHole.parSnapshot) : null;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900">
      <div className="absolute inset-0">
        {layout ? (
          <HolePlayMap
            geometry={layout}
            playerPosition={playerPosition}
            caddyHeatmap={caddyHeatmap}
            holeKey={holeNumber}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-300">Ingen layout sparad för detta hål.</div>
        )}
      </div>

      <BackButton onClick={() => router.push('/')} />

      {/* Overview shortcut — small pill at top-left below back button */}
      <Link
        href={`/play/round/${roundId}/overview`}
        className="absolute left-3 top-16 z-20 flex items-center gap-1 bg-white/90 text-slate-800 text-xs font-semibold rounded-full px-3 py-1 shadow"
        aria-label="Se rund-översikt"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        Översikt
      </Link>

      <HoleHeader
        holeNumber={roundHole.holeNumber}
        par={roundHole.parSnapshot}
        length={roundHole.lengthSnapshot}
        hcpIndex={roundHole.hcpIndexSnapshot}
        distanceToGreenMeters={distanceToGreen}
      />

      <TopRightFabs onSettings={() => setSettingsOpen(true)} />

      <HeatmapRail
        hasCaddyData={hasCaddyData}
        clubsWithData={heatmapClubsWithData}
        isOpen={heatmapOpen}
        onToggle={() => setHeatmapOpen((v) => !v)}
        selectedClubId={selectedClubId}
        onSelectClub={(id) => {
          setSelectedClubId(id);
          setManualOverride(true);
        }}
        autoSelectedClubId={recommendation?.clubKey ?? null}
        showAutoBadge={autoEnabled}
        showResetAuto={autoEnabled && manualOverride}
        onResetAuto={() => setManualOverride(false)}
      />

      {isGroup && isWolf ? (
        <>
          <div className="absolute left-0 right-0 bottom-16 z-10 px-3 pb-2 max-h-[55vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-white text-xs font-bold drop-shadow">
                Hål {roundHole.holeNumber} • {players.length} spelare
              </span>
              <button
                onClick={() => void reload()}
                disabled={refreshing}
                aria-label="Uppdatera scores"
                className="bg-white/90 text-primary rounded-full w-9 h-9 flex items-center justify-center font-bold disabled:opacity-50"
              >
                <span className={refreshing ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
              </button>
            </div>
            <GroupScoreBoard
              format={format}
              players={players}
              roundHole={roundHole}
              par={roundHole.parSnapshot}
              scoresByPlayer={scoresByPlayer}
              onChangeStrokes={(playerId, strokes) => void updatePlayerStrokes(playerId, strokes)}
              onChangeWolfRole={(playerId, role) => void updatePlayerWolfRole(playerId, role)}
            />
          </div>
          <GroupControlBar
            isLastHole={holeNumber >= maxHole}
            onSubmit={groupNext}
            saving={savingGroup}
          />
        </>
      ) : isGroup ? (
        <>
          <ScoreChipBar
            players={players}
            scoresByPlayer={scoresByPlayer}
            isLastHole={holeNumber >= maxHole}
            saving={savingGroup}
            onTapPlayer={(id) => setScorePadPlayerId(id)}
            onSubmit={groupNext}
          />
          <ScorePadSheet
            open={scorePadPlayer !== null}
            player={scorePadPlayer}
            holeNumber={roundHole.holeNumber}
            par={roundHole.parSnapshot}
            currentStrokes={scorePadPlayer ? scoresByPlayer.get(scorePadPlayer.id)?.strokes ?? null : null}
            onClose={() => setScorePadPlayerId(null)}
            onSubmit={(strokes) => {
              if (scorePadPlayer) void updatePlayerStrokes(scorePadPlayer.id, strokes);
              setScorePadPlayerId(null);
            }}
          />
        </>
      ) : (
        <>
          {soloPoints !== null ? (
            <div className="absolute right-3 bottom-20 z-10 bg-white/95 rounded-full px-3 py-1 text-sm font-bold text-primary shadow">
              {soloPoints}p
            </div>
          ) : null}
          <RoundControlBar
            score={score}
            onScoreChange={setScore}
            isLastHole={holeNumber >= maxHole}
            onSubmit={saveAndNext}
          />
        </>
      )}

      <HoleSettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        hasCaddyData={hasCaddyData}
        autoEnabled={autoEnabled}
        onAutoChange={(enabled) => {
          setAutoEnabled(enabled);
          if (enabled) setManualOverride(false);
        }}
        recommendation={recommendation}
        courseId={courseId}
        holeNumber={holeNumber}
        maxHole={maxHole}
        onSelectHole={(n) => {
          if (n === holeNumber) return;
          setSettingsOpen(false);
          void roundsStore.setCurrentHole(roundId, n).catch(() => undefined);
          router.replace(`/play/round/${roundId}/${n}`);
        }}
        onOpenEdit={() => {
          setSettingsOpen(false);
          if (courseId) router.push(`/admin/courses/${courseId}/hole/${holeNumber}`);
        }}
      />
    </div>
  );
}
