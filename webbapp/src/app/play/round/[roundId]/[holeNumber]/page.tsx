'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useCaddyApi, useCoursesApi } from '@/lib/api';
import { useRoundsStore } from '@/lib/roundsStore';
import type { ServerRoundHole } from '@/lib/api';
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

const HolePlayMap = dynamic(() => import('@/components/HolePlayMap').then((m) => m.HolePlayMap), { ssr: false });

export default function RoundHolePage() {
  const params = useParams();
  const router = useRouter();
  const roundId = String(params?.roundId ?? '');
  const holeNumber = Number(params?.holeNumber ?? 1);

  const coursesApi = useCoursesApi();
  const caddyApi = useCaddyApi();
  const roundsStore = useRoundsStore();
  const toast = useToast();

  const [round, setRound] = useState<Round | null>(null);
  const [roundHole, setRoundHole] = useState<ServerRoundHole | null>(null);
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
  const [recenterTick, setRecenterTick] = useState(0);

  const { enabled: autoEnabled, setEnabled: setAutoEnabled } = useHeatmapAuto();

  // Ladda runda + hål
  useEffect(() => {
    if (!roundsStore.ready) return;
    let active = true;
    void (async () => {
      const r = await roundsStore.getRound(roundId);
      if (!active) return;
      if (!r) {
        router.replace('/play');
        return;
      }
      setRound(r.round);
      setMaxHole(r.roundHoles.length);
      setCourseId(r.round.courseId);
      const rh = r.roundHoles.find((x) => x.holeNumber === holeNumber) ?? null;
      setRoundHole(rh);
      setScore(rh?.strokes?.toString() ?? '');
    })();
    return () => {
      active = false;
    };
  }, [roundId, holeNumber, router, roundsStore]);

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
    return <div className="flex items-center justify-center h-screen text-white">Laddar hål...</div>;
  }

  const saveAndNext = async () => {
    const parsed = parseStrokes(score);
    if (score.trim() && parsed === null) {
      toast.error('Ange ett heltal som är 0 eller större.');
      return;
    }
    try {
      await roundsStore.saveScore(roundId, holeNumber, parsed);
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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900">
      <div className="absolute inset-0">
        {layout ? (
          <HolePlayMap
            geometry={layout}
            playerPosition={playerPosition}
            caddyHeatmap={caddyHeatmap}
            holeKey={holeNumber}
            recenterTick={recenterTick}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-300">Ingen layout sparad för detta hål.</div>
        )}
      </div>

      <BackButton onClick={() => router.back()} />

      <HoleHeader
        holeNumber={roundHole.holeNumber}
        par={roundHole.parSnapshot}
        length={roundHole.lengthSnapshot}
        hcpIndex={roundHole.hcpIndexSnapshot}
        distanceToGreenMeters={distanceToGreen}
      />

      <TopRightFabs onSettings={() => setSettingsOpen(true)} onRecenter={() => setRecenterTick((t) => t + 1)} />

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

      <RoundControlBar
        score={score}
        onScoreChange={setScore}
        isLastHole={holeNumber >= maxHole}
        onSubmit={saveAndNext}
      />

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
        onOpenEdit={() => {
          setSettingsOpen(false);
          if (courseId) router.push(`/admin/courses/${courseId}/hole/${holeNumber}`);
        }}
      />
    </div>
  );
}
