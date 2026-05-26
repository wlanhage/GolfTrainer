'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useCaddyApi, useCoursesApi, useAiApi } from '@/lib/api';
import { useRoundsStore } from '@/lib/roundsStore';
import type { ServerRoundHole, ServerRoundHoleScore, ServerRoundPlayer, ServerWolfRole } from '@/lib/api';
import { useRoundsApi } from '@/lib/api';
import { stablefordPoints } from '@/lib/scoring';
import { GroupScoreBoard } from '@/components/play/GroupScoreBoard';
import { ScoreChipBar } from '@/components/play/ScoreChipBar';
import { ScorePadSheet } from '@/components/play/ScorePadSheet';
import { GroupControlBar } from '@/components/round-hole/GroupControlBar';
import { EndRoundConfirmIncomplete, EndRoundDialog } from '@/components/round-hole/EndRoundDialog';
import { caddyClubs } from '@/lib/caddyClubs';
import { getGreenDistances, resolveHeatmapBearing } from '@/lib/holeGeometry';
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
import { RightActionRail } from '@/components/round-hole/RightActionRail';
import { RoundControlBar } from '@/components/round-hole/RoundControlBar';
import { HoleSettingsSheet } from '@/components/round-hole/HoleSettingsSheet';
import { ShotTrackingRail } from '@/components/round-hole/ShotTrackingRail';
import { CameraRecommendSheet } from '@/components/round-hole/CameraRecommendSheet';
import { AiChoiceSheet } from '@/components/round-hole/AiChoiceSheet';
import { ShotReviewSheet, type ReviewShot } from '@/components/round-hole/ShotReviewSheet';
import { shotTrackingStore } from '@/lib/shotTrackingStore';
import { Loader } from '@/components/Loader';

const HolePlayMap = dynamic(() => import('@/components/HolePlayMap').then((m) => m.HolePlayMap), { ssr: false });

export default function RoundHolePage() {
  const params = useParams();
  const router = useRouter();
  const roundId = String(params?.roundId ?? '');
  const holeNumber = Number(params?.holeNumber ?? 1);

  const { me } = useAuth();
  const coursesApi = useCoursesApi();
  const caddyApi = useCaddyApi();
  const roundsApi = useRoundsApi();
  const aiApi = useAiApi();
  const roundsStore = useRoundsStore();
  const toast = useToast();

  const [round, setRound] = useState<Round | null>(null);
  const [roundHole, setRoundHole] = useState<ServerRoundHole | null>(null);
  const [players, setPlayers] = useState<ServerRoundPlayer[]>([]);
  const [scoresByPlayer, setScoresByPlayer] = useState<Map<string, ServerRoundHoleScore>>(new Map());
  const [allRoundHoles, setAllRoundHoles] = useState<ServerRoundHole[]>([]);
  const [scorePadPlayerId, setScorePadPlayerId] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [confirmIncompleteOpen, setConfirmIncompleteOpen] = useState(false);
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

  // AI recommendation state
  const [aiChoiceOpen, setAiChoiceOpen] = useState(false);
  const [cameraSheetOpen, setCameraSheetOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [dataRecOpen, setDataRecOpen] = useState(false);
  const [dataRecLoading, setDataRecLoading] = useState(false);
  const [dataRecResult, setDataRecResult] = useState<string | null>(null);
  const [dataRecError, setDataRecError] = useState<string | null>(null);

  // Shot tracking state
  const [shotTrackingEnabled, setShotTrackingEnabled] = useState(false);
  const [shotRailOpen, setShotRailOpen] = useState(false);
  const [lastShotClub, setLastShotClub] = useState<string | null>(null);
  const [lastShotId, setLastShotId] = useState<string | null>(null);
  const [lastShotPosition, setLastShotPosition] = useState<GeoPoint | null>(null);
  const [bagClubs, setBagClubs] = useState<Array<{ id: string; name: string }>>([]);

  // Shot review state
  const [shotReviewOpen, setShotReviewOpen] = useState(false);
  const [holeShots, setHoleShots] = useState<ReviewShot[]>([]);
  const [shotToastVisible, setShotToastVisible] = useState(false);
  const [shotToastPutts, setShotToastPutts] = useState<number | null>(null);
  const [shotToastCount, setShotToastCount] = useState(0);
  const shotToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize shot tracking from localStorage
  useEffect(() => {
    const enabled = shotTrackingStore.isEnabled();
    setShotTrackingEnabled(enabled);
    if (enabled) {
      const selectedIds = shotTrackingStore.getSelectedClubs();
      const filtered = caddyClubs.filter((c) => selectedIds.includes(c.id));
      setBagClubs(filtered);
    }
  }, []);

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
        setAllRoundHoles(r.roundHoles);
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

  const greenDistances = useMemo(() => {
    if (!layout || !playerPosition) return null;
    return getGreenDistances(playerPosition, layout);
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

  const handleCameraRecommend = async (base64: string): Promise<string> => {
    setCameraLoading(true);
    try {
      const { response } = await aiApi.recommendClub({
        imageBase64: base64,
        distanceToGreenFront: greenDistances?.front ?? undefined,
        distanceToGreenMiddle: greenDistances?.middle ?? undefined,
        distanceToGreenBack: greenDistances?.back ?? undefined,
        holeNumber,
        par: roundHole?.parSnapshot ?? undefined,
        roundId,
      });
      return response;
    } finally {
      setCameraLoading(false);
    }
  };

  const handleDataRecommend = async () => {
    setDataRecOpen(true);
    setDataRecLoading(true);
    setDataRecResult(null);
    setDataRecError(null);
    try {
      const { response } = await aiApi.dataRecommendClub({
        distanceToGreenFront: greenDistances?.front ?? undefined,
        distanceToGreenMiddle: greenDistances?.middle ?? undefined,
        distanceToGreenBack: greenDistances?.back ?? undefined,
        holeNumber,
        par: roundHole?.parSnapshot ?? undefined,
        roundId,
      });
      setDataRecResult(response);
    } catch (err) {
      const { getAiErrorKey } = await import('@/lib/aiErrorMapper');
      setDataRecError(getAiErrorKey(err));
    } finally {
      setDataRecLoading(false);
    }
  };

  /** Haversine distance in meters between two geo points */
  const geoDistanceM = (a: GeoPoint, b: GeoPoint) => {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const SAME_SPOT_THRESHOLD_M = 5;

  const handleLogShot = async (clubId: string) => {
    if (!playerPosition) {
      toast.error('GPS-position saknas');
      return;
    }

    // If we haven't moved more than 5m since last shot → club change (replace)
    const isSameSpot =
      lastShotId &&
      lastShotPosition &&
      geoDistanceM(playerPosition, lastShotPosition) < SAME_SPOT_THRESHOLD_M;

    try {
      if (isSameSpot && lastShotId) {
        // Delete old shot, then log new one with updated club
        await roundsApi.deleteShot(roundId, lastShotId);
      }

      const result = await roundsApi.logShot(roundId, {
        holeNumber,
        clubId,
        fromLat: playerPosition.lat,
        fromLng: playerPosition.lng,
      });
      setLastShotClub(clubId);
      setLastShotId(result.id);
      setLastShotPosition({ lat: playerPosition.lat, lng: playerPosition.lng });
      setShotRailOpen(false);
      toast.success(isSameSpot ? 'Klubba bytt!' : 'Slag loggat!');
    } catch (e) {
      toast.error(`Kunde inte logga slag: ${(e as Error).message}`);
    }
  };

  /** Load shots for current hole and show summary toast after score save */
  const showShotSummaryToast = async (savedScore: number | null) => {
    if (!shotTrackingEnabled || savedScore === null) return;
    try {
      const allShots = await roundsApi.listShots(roundId);
      const currentHoleShots = allShots
        .filter((s) => s.holeNumber === holeNumber)
        .sort((a, b) => a.shotOrder - b.shotOrder)
        .map((s) => ({
          id: s.id,
          shotOrder: s.shotOrder,
          clubId: s.clubId,
          distanceMeters: s.distanceMeters,
        }));
      if (currentHoleShots.length === 0) return;
      setHoleShots(currentHoleShots);
      const putts = Math.max(0, savedScore - currentHoleShots.length);
      setShotToastPutts(putts);
      setShotToastCount(currentHoleShots.length);
      setShotToastVisible(true);
      if (shotToastTimerRef.current) clearTimeout(shotToastTimerRef.current);
      shotToastTimerRef.current = setTimeout(() => setShotToastVisible(false), 5000);
    } catch {
      // silently ignore — non-critical
    }
  };

  const handleShotReviewChangeClub = async (shotId: string, clubId: string) => {
    // Optimistic UI update
    setHoleShots((prev) => prev.map((s) => s.id === shotId ? { ...s, clubId } : s));
    // Note: We'd need a PATCH endpoint for this — for now just update locally.
    // The shot will be correct next time it's loaded. TODO: add PATCH endpoint.
  };

  const handleShotReviewDelete = async (shotId: string) => {
    setHoleShots((prev) => prev.filter((s) => s.id !== shotId));
    try {
      await roundsApi.deleteShot(roundId, shotId);
    } catch (e) {
      toast.error(`Kunde inte ta bort slag: ${(e as Error).message}`);
    }
  };

  const openShotReview = async () => {
    try {
      const allShots = await roundsApi.listShots(roundId);
      const currentHoleShots = allShots
        .filter((s) => s.holeNumber === holeNumber)
        .sort((a, b) => a.shotOrder - b.shotOrder)
        .map((s) => ({
          id: s.id,
          shotOrder: s.shotOrder,
          clubId: s.clubId,
          distanceMeters: s.distanceMeters,
        }));
      setHoleShots(currentHoleShots);
      setShotReviewOpen(true);
    } catch (e) {
      toast.error(`Kunde inte hämta slag: ${(e as Error).message}`);
    }
  };

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
      // Show shot summary toast before navigating
      void showShotSummaryToast(parsed);
      if (holeNumber >= maxHole) {
        await roundsStore.completeRound(roundId);
        router.replace(`/play/round/${roundId}/summary`);
        return;
      }
      await roundsStore.setCurrentHole(roundId, holeNumber + 1);
      router.replace(`/play/round/${roundId}/${holeNumber + 1}`);
    } catch (e) {
      toast.error(`Kunde inte spara: ${(e as Error).message}`);
    }
  };

  const isLastHole = holeNumber >= maxHole;
  const isHost = !!(me?.id && round?.userId === me.id);
  const activePlayers = players.filter((p) => !p.leftAt);
  const hasIncompleteHoles = allRoundHoles.some((h) =>
    activePlayers.some((p) => (h.scores?.find((s) => s.playerId === p.id)?.strokes ?? null) === null)
  );

  const groupNext = async () => {
    if (isLastHole && players.length > 1) {
      setEndDialogOpen(true);
      return;
    }
    setSavingGroup(true);
    try {
      // Show shot summary toast for group play (use host player score)
      const hostScore = players[0] ? scoresByPlayer.get(players[0].id)?.strokes ?? null : null;
      void showShotSummaryToast(hostScore);
      if (isLastHole) {
        await roundsStore.completeRound(roundId);
        router.replace(`/play/round/${roundId}/summary`);
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

  const requestEndForAll = () => {
    if (hasIncompleteHoles) {
      setEndDialogOpen(false);
      setConfirmIncompleteOpen(true);
      return;
    }
    void endForAll();
  };

  const endForAll = async () => {
    setSavingGroup(true);
    try {
      await roundsStore.completeRound(roundId);
      router.replace(`/play/round/${roundId}/summary`);
    } catch (e) {
      toast.error(`Kunde inte avsluta: ${(e as Error).message}`);
    } finally {
      setSavingGroup(false);
      setEndDialogOpen(false);
      setConfirmIncompleteOpen(false);
    }
  };

  const leaveForMe = async () => {
    setSavingGroup(true);
    try {
      await roundsApi.leave(roundId);
      router.replace(`/play/round/${roundId}/summary`);
    } catch (e) {
      toast.error(`Kunde inte lämna runda: ${(e as Error).message}`);
    } finally {
      setSavingGroup(false);
      setEndDialogOpen(false);
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

  const hostPlayerStrokes = players[0] ? scoresByPlayer.get(players[0].id)?.strokes ?? null : parseStrokes(score);
  const soloPoints = isStableford ? stablefordPoints(hostPlayerStrokes, roundHole.parSnapshot) : null;

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

      <HoleHeader
        holeNumber={roundHole.holeNumber}
        par={roundHole.parSnapshot}
        length={roundHole.lengthSnapshot}
        hcpIndex={roundHole.hcpIndexSnapshot}
        greenDistances={greenDistances}
      />

      <TopRightFabs
        onSettings={() => setSettingsOpen(true)}
        overviewHref={`/play/round/${roundId}/overview`}
      />

      <ShotTrackingRail
        isOpen={shotRailOpen}
        onClose={() => setShotRailOpen(false)}
        clubs={bagClubs}
        onLogShot={(clubId) => void handleLogShot(clubId)}
        lastShotClub={lastShotClub}
      />

      <AiChoiceSheet
        isOpen={aiChoiceOpen}
        onClose={() => setAiChoiceOpen(false)}
        onCamera={() => setCameraSheetOpen(true)}
        onData={() => void handleDataRecommend()}
      />

      <CameraRecommendSheet
        isOpen={cameraSheetOpen}
        onClose={() => setCameraSheetOpen(false)}
        onCapture={handleCameraRecommend}
        loading={cameraLoading}
      />

      {/* Data-only AI recommendation sheet */}
      {dataRecOpen && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDataRecOpen(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">AI Klubbrekommendation</h3>
              <button onClick={() => setDataRecOpen(false)} className="text-slate-400 text-xl font-bold">&times;</button>
            </div>

            {dataRecLoading && (
              <div className="flex items-center gap-3 py-6 justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-600">Analyserar...</span>
              </div>
            )}

            {dataRecResult && !dataRecLoading && (
              <div className="py-4 px-4 bg-green-50 border border-green-100 rounded-xl">
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{dataRecResult}</p>
              </div>
            )}

            {dataRecError && !dataRecLoading && (
              <div className="py-4 px-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-700">{dataRecError}</p>
              </div>
            )}

            {!dataRecLoading && (
              <button
                onClick={() => setDataRecOpen(false)}
                className="w-full mt-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                Stäng
              </button>
            )}
          </div>
        </div>
      )}

      <RightActionRail
        hasCaddyData={hasCaddyData}
        heatmapOpen={heatmapOpen}
        onToggleHeatmap={() => setHeatmapOpen((v) => !v)}
        shotTrackingEnabled={shotTrackingEnabled}
        onShotTracking={() => setShotRailOpen((v) => !v)}
        onAi={() => setAiChoiceOpen(true)}
      />

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

      {isWolf ? (
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
      ) : players.length >= 1 ? (
        <>
          {soloPoints !== null && !isGroup ? (
            <div className="absolute right-3 bottom-20 z-10 bg-white/95 rounded-full px-3 py-1 text-sm font-bold text-primary shadow">
              {soloPoints}p
            </div>
          ) : null}
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
        <RoundControlBar
          score={score}
          onScoreChange={setScore}
          isLastHole={holeNumber >= maxHole}
          onSubmit={saveAndNext}
        />
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
        shotTrackingEnabled={shotTrackingEnabled}
        onOpenShotReview={() => void openShotReview()}
      />

      {/* Shot summary toast — tappable to open review */}
      {shotToastVisible && shotTrackingEnabled && (
        <button
          type="button"
          onClick={() => { setShotToastVisible(false); setShotReviewOpen(true); }}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-black/80 backdrop-blur-sm text-white font-semibold text-sm rounded-full px-5 py-2.5 shadow-lg whitespace-nowrap animate-[fadeIn_0.2s_ease-out]"
        >
          {shotToastCount} slag ⛳ {shotToastPutts} {shotToastPutts === 1 ? 'putt' : 'puttar'}
        </button>
      )}

      <ShotReviewSheet
        isOpen={shotReviewOpen}
        onClose={() => setShotReviewOpen(false)}
        shots={holeShots}
        score={hostPlayerStrokes}
        putts={hostPlayerStrokes !== null && holeShots.length > 0 ? Math.max(0, hostPlayerStrokes - holeShots.length) : null}
        onChangeClub={handleShotReviewChangeClub}
        onDeleteShot={(shotId) => void handleShotReviewDelete(shotId)}
      />

      <EndRoundDialog
        open={endDialogOpen}
        isHost={isHost}
        hasIncompleteHoles={hasIncompleteHoles}
        saving={savingGroup}
        onLeaveSelf={() => void leaveForMe()}
        onEndForAll={requestEndForAll}
        onCancel={() => setEndDialogOpen(false)}
      />

      <EndRoundConfirmIncomplete
        open={confirmIncompleteOpen}
        saving={savingGroup}
        onConfirm={() => void endForAll()}
        onCancel={() => setConfirmIncompleteOpen(false)}
      />
    </div>
  );
}
