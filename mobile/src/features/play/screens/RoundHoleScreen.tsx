import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, InputAccessoryView, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { useCaddyApi } from '../../caddy/api/caddyApi';
import { caddyClubs } from '../../caddy/data/caddyClubs';
import { CaddyClubSummary, CaddyShot } from '../../caddy/types/caddy';
import { CaddyMapHeatmap, HolePlayMap } from '../components/HolePlayMap';
import { resolveHoleAxis } from '../services/holeAxis';
import { getDistanceToGreenMeters } from '../services/holeDistance';
import { playStorage } from '../storage/playStorage';
import { GeoPoint, HoleLayoutGeometry, RoundHole } from '../types/play';
import { parseStrokes } from '../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'RoundHole'>;

const scoreInputAccessoryId = 'round-hole-score-input-accessory';
const HEATMAP_GRID_SIZE = 7;
const HEATMAP_BIN_SIZE_METERS = 10;

export function RoundHoleScreen({ route, navigation }: Props) {
  const { roundId, holeNumber } = route.params;
  const insets = useSafeAreaInsets();
  const caddyApi = useCaddyApi();
  const scoreInputRef = useRef<TextInput>(null);
  const [roundHole, setRoundHole] = useState<RoundHole | null>(null);
  const [score, setScore] = useState('');
  const [layout, setLayout] = useState<HoleLayoutGeometry | null>(null);
  const [maxHoleNumber, setMaxHoleNumber] = useState(18);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [playerPosition, setPlayerPosition] = useState<GeoPoint | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [selectedHeatmapClubId, setSelectedHeatmapClubId] = useState('driver');
  const [caddySummaries, setCaddySummaries] = useState<CaddyClubSummary[]>([]);
  const [heatmapShots, setHeatmapShots] = useState<CaddyShot[]>([]);

  const load = () => {
    playStorage.getRoundHole(roundId, holeNumber).then((result) => {
      if (!result) return;
      setRoundHole(result.roundHole);
      setScore(result.roundHole.strokes?.toString() ?? '');
      setLayout(result.layout?.geometry ?? null);
      setCourseId(result.round.courseId);
    });

    playStorage.getRound(roundId).then((result) => {
      if (!result) return;
      setMaxHoleNumber(result.roundHoles.length);
    });
  };

  useEffect(() => {
    load();
  }, [roundId, holeNumber]);

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((position: { coords: { latitude: number; longitude: number } }) => setPlayerPosition({ lat: position.coords.latitude, lng: position.coords.longitude }))
      .catch(() => setPlayerPosition(null));
  }, [holeNumber]);

  useEffect(() => {
    if (!heatmapVisible) return;

    let active = true;

    const run = async () => {
      const [summaries, shots] = await Promise.all([
        caddyApi.listClubSummaries(),
        caddyApi.listShotsForClub(selectedHeatmapClubId)
      ]);

      if (active) {
        setCaddySummaries(summaries);
        setHeatmapShots(shots);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [caddyApi, heatmapVisible, selectedHeatmapClubId]);

  const distanceToGreen = useMemo(() => {
    if (!layout || !playerPosition) return null;
    return getDistanceToGreenMeters(playerPosition, layout);
  }, [layout, playerPosition]);

  const caddyHeatmap = useMemo<CaddyMapHeatmap | null>(() => {
    if (!heatmapVisible || !layout) return null;

    const axis = resolveHoleAxis(layout);
    const origin = playerPosition ?? layout.teePoint ?? axis?.origin;
    if (!axis || !origin || heatmapShots.length === 0) return null;

    const selectedSummary = caddySummaries.find((item) => item.clubKey === selectedHeatmapClubId);
    const centerDistance =
      selectedSummary?.distanceMeters ??
      heatmapShots.reduce((sum, shot) => sum + shot.distanceMeters, 0) / heatmapShots.length;

    const half = Math.floor(HEATMAP_GRID_SIZE / 2);
    const counts = new Map<string, { lateralBin: number; forwardBin: number; count: number }>();

    for (const shot of heatmapShots) {
      const lateralBin = Math.max(-half, Math.min(half, Math.round(shot.lateralOffsetMeters / HEATMAP_BIN_SIZE_METERS)));
      const forwardBin = Math.max(-half, Math.min(half, Math.round((shot.distanceMeters - centerDistance) / HEATMAP_BIN_SIZE_METERS)));
      const id = `${forwardBin}:${lateralBin}`;
      const current = counts.get(id);
      counts.set(id, { lateralBin, forwardBin, count: (current?.count ?? 0) + 1 });
    }

    const maxCount = Math.max(...Array.from(counts.values()).map((cell) => cell.count), 1);
    const total = heatmapShots.length;

    return {
      origin,
      bearing: axis.bearing,
      cells: Array.from(counts.values()).map((cell) => ({
        id: `${selectedHeatmapClubId}-${cell.forwardBin}-${cell.lateralBin}`,
        forwardMeters: centerDistance + cell.forwardBin * HEATMAP_BIN_SIZE_METERS,
        lateralMeters: cell.lateralBin * HEATMAP_BIN_SIZE_METERS,
        count: cell.count,
        percentage: Math.round((cell.count / total) * 100),
        intensity: cell.count / maxCount
      }))
    };
  }, [caddySummaries, heatmapShots, heatmapVisible, layout, playerPosition, selectedHeatmapClubId]);

  const heatmapClubsWithData = useMemo(() => {
    const clubKeysWithData = new Set(caddySummaries.filter((summary) => summary.sampleCount > 0).map((summary) => summary.clubKey));
    return caddyClubs.filter((club) => clubKeysWithData.has(club.id));
  }, [caddySummaries]);

  useEffect(() => {
    if (!heatmapVisible || heatmapClubsWithData.length === 0) return;
    if (heatmapClubsWithData.some((club) => club.id === selectedHeatmapClubId)) return;

    setSelectedHeatmapClubId(heatmapClubsWithData[0].id);
  }, [heatmapClubsWithData, heatmapVisible, selectedHeatmapClubId]);

  if (!roundHole || !layout) {
    return (
      <View style={styles.loading}>
        <Text>Laddar hål...</Text>
      </View>
    );
  }

  const saveAndNext = async () => {
    Keyboard.dismiss();

    const parsedStrokes = parseStrokes(score);
    if (score.trim() && parsedStrokes === null) {
      return Alert.alert('Felaktigt resultat', 'Ange ett heltal som är 0 eller större.');
    }

    await playStorage.saveRoundHoleScore(roundId, holeNumber, parsedStrokes);

    if (holeNumber >= maxHoleNumber) {
      await playStorage.completeRound(roundId);
      navigation.replace('RoundOverview', { roundId });
      return;
    }

    await playStorage.setCurrentHole(roundId, holeNumber + 1);
    navigation.replace('RoundHole', { roundId, holeNumber: holeNumber + 1 });
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <HolePlayMap geometry={layout} playerPosition={playerPosition} caddyHeatmap={caddyHeatmap} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gå tillbaka"
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => {
          Keyboard.dismiss();
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          navigation.navigate('Play');
        }}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>

      <View style={[styles.overlayTop, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.holeTitle}>Hål {roundHole.holeNumber}</Text>
        <Text style={styles.holeMeta}>Par: {roundHole.parSnapshot ?? '-'} • Längd: {roundHole.lengthSnapshot ?? '-'} • HCP: {roundHole.hcpIndexSnapshot ?? '-'}</Text>
        <Text style={styles.distance}>
          {distanceToGreen === null ? 'Avstånd till green: saknas layout eller GPS' : `Avstånd till green: ${Math.round(distanceToGreen)} m`}
        </Text>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom + 12, 18) }]}>
        <Pressable
          style={styles.scoreControl}
          hitSlop={8}
          onPress={() => {
            setScore('');
            scoreInputRef.current?.focus();
          }}
        >
          <Text style={styles.scoreLabel}>Antal slag</Text>
          <TextInput
            ref={scoreInputRef}
            value={score}
            onChangeText={setScore}
          keyboardType="number-pad"
            inputAccessoryViewID={Platform.OS === 'ios' ? scoreInputAccessoryId : undefined}
            onFocus={() => setScore('')}
            onPressIn={() => setScore('')}
            onSubmitEditing={() => Keyboard.dismiss()}
          returnKeyType="done"
          blurOnSubmit
            placeholder="0"
            style={styles.scoreInput}
          />
        </Pressable>
        <Pressable style={styles.nextButton} onPress={() => void saveAndNext()}>
          <Text style={styles.nextButtonText}>{holeNumber >= maxHoleNumber ? 'Avsluta runda' : 'Nästa hål'}</Text>
        </Pressable>
      </View>

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={scoreInputAccessoryId}>
          <View style={styles.keyboardAccessory}>
            <Pressable style={styles.keyboardDoneButton} onPress={() => Keyboard.dismiss()}>
              <Text style={styles.keyboardDoneButtonText}>Klar</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      <Pressable style={[styles.settingsFab, { top: insets.top + 8 }]} onPress={() => setSettingsVisible(true)}>
        <Text style={styles.settingsFabIcon}>⚙️</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Visa caddy heatmap"
        style={[styles.heatmapFab, heatmapVisible && styles.heatmapFabActive, { top: insets.top + 60 }]}
        onPress={() => setHeatmapVisible((visible) => !visible)}
      >
        <Text style={[styles.heatmapFabIcon, heatmapVisible && styles.heatmapFabIconActive]}>▦</Text>
      </Pressable>

      {heatmapVisible ? (
        <ScrollView
          style={[styles.heatmapClubRail, { top: insets.top + 112 }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.clubPicker}
        >
          {heatmapClubsWithData.map((club) => (
            <Pressable
              key={club.id}
              style={[styles.clubPill, club.id === selectedHeatmapClubId && styles.clubPillActive]}
              onPress={() => setSelectedHeatmapClubId(club.id)}
            >
              <Text style={[styles.clubPillText, club.id === selectedHeatmapClubId && styles.clubPillTextActive]}>{getCaddyClubShortLabel(club.id)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Modal animationType="slide" transparent visible={settingsVisible} onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setSettingsVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Inställningar</Text>
            <Text style={styles.toggleSubtitle}>Kartvyn används alltid i fullskärm under spel.</Text>
            {courseId ? (
              <Pressable
                style={styles.editViewButton}
                onPress={() => {
                  setSettingsVisible(false);
                  navigation.navigate('AdminHoleEdit', { courseId, holeNumber });
                }}
              >
                <Text style={styles.editViewButtonText}>Öppna edit view för hål {holeNumber}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.closeButton} onPress={() => setSettingsVisible(false)}>
              <Text style={styles.closeButtonText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getCaddyClubShortLabel = (clubId: string) => {
  if (clubId === 'driver') return 'D';
  if (clubId.startsWith('fairway-')) return `F${clubId.replace('fairway-', '')}`;
  if (clubId.startsWith('hybrid-')) return `H${clubId.replace('hybrid-', '')}`;
  if (clubId.startsWith('iron-')) return `J${clubId.replace('iron-', '')}`;
  if (clubId === 'pitch') return 'P';
  if (clubId === 'gap-wedge') return 'G';
  if (clubId === 'sand-wedge') return 'S';
  if (clubId === 'lob-wedge') return 'L';

  return clubId.slice(0, 1).toUpperCase();
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { ...StyleSheet.absoluteFillObject },
  backButton: {
    position: 'absolute',
    left: 12,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)'
  },
  backButtonText: { color: '#fff', fontSize: 38, lineHeight: 40, fontWeight: '500' },
  overlayTop: { paddingHorizontal: 12, gap: 6, marginLeft: 52, marginRight: 52 },
  holeTitle: { fontSize: 30, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(15,23,42,0.7)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  holeMeta: { color: '#e2e8f0', fontWeight: '600', textShadowColor: 'rgba(15,23,42,0.7)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  distance: { color: '#fff', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(15,23,42,0.7)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  controls: {
    marginTop: 'auto',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.92)'
  },
  scoreControl: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12
  },
  scoreLabel: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '800' },
  scoreInput: {
    minWidth: 40,
    padding: 0,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right'
  },
  keyboardAccessory: {
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  keyboardDoneButton: { paddingHorizontal: 14, paddingVertical: 8 },
  keyboardDoneButtonText: { color: '#0f766e', fontSize: 16, fontWeight: '800' },
  nextButton: { flex: 1, minHeight: 46, backgroundColor: '#0f766e', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  nextButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  settingsFab: {
    position: 'absolute',
    right: 14,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  settingsFabIcon: { fontSize: 24 },
  heatmapFab: {
    position: 'absolute',
    right: 14,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  heatmapFabActive: {
    backgroundColor: '#16a34a'
  },
  heatmapFabIcon: {
    color: '#0f172a',
    fontSize: 27,
    lineHeight: 30,
    fontWeight: '900'
  },
  heatmapFabIconActive: {
    color: '#ffffff'
  },
  heatmapClubRail: {
    position: 'absolute',
    right: 14,
    bottom: 96,
    zIndex: 4,
    width: 44
  },
  clubPicker: {
    gap: 7,
    paddingVertical: 2
  },
  clubPill: {
    width: 44,
    height: 34,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1'
  },
  clubPillActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a'
  },
  clubPillText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800'
  },
  clubPillTextActive: {
    color: '#ffffff'
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  toggleSubtitle: { color: '#475569', fontSize: 12 },
  editViewButton: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  editViewButtonText: { color: '#fff', fontWeight: '700' },
  closeButton: { marginTop: 4, backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontWeight: '700' }
});
