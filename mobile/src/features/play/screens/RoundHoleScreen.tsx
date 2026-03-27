import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { HolePlayMap } from '../components/HolePlayMap';
import { getDistanceToGreenMeters } from '../services/holeDistance';
import { playStorage } from '../storage/playStorage';
import { GeoPoint, HoleLayoutGeometry, RoundHole } from '../types/play';
import { parseStrokes } from '../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'RoundHole'>;

export function RoundHoleScreen({ route, navigation }: Props) {
  const { roundId, holeNumber } = route.params;
  const [roundHole, setRoundHole] = useState<RoundHole | null>(null);
  const [score, setScore] = useState('');
  const [layout, setLayout] = useState<HoleLayoutGeometry | null>(null);
  const [maxHoleNumber, setMaxHoleNumber] = useState(18);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [playerPosition, setPlayerPosition] = useState<GeoPoint | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [useFallbackBackground, setUseFallbackBackground] = useState(false);

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

  const distanceToGreen = useMemo(() => {
    if (!layout || !playerPosition) return null;
    return getDistanceToGreenMeters(playerPosition, layout);
  }, [layout, playerPosition]);

  if (!roundHole || !layout) {
    return (
      <View style={styles.loading}>
        <Text>Laddar hål...</Text>
      </View>
    );
  }

  const saveAndNext = async () => {
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
        <HolePlayMap geometry={layout} playerPosition={playerPosition} useFallbackBackground={useFallbackBackground} />
      </View>

      <View style={styles.overlayTop}>
        <Text style={styles.holeTitle}>Hål {roundHole.holeNumber}</Text>
        <Text style={styles.holeMeta}>Par: {roundHole.parSnapshot ?? '-'} • Längd: {roundHole.lengthSnapshot ?? '-'} • HCP: {roundHole.hcpIndexSnapshot ?? '-'}</Text>
        <Text style={styles.distance}>
          {distanceToGreen === null ? 'Avstånd till green: saknas layout eller GPS' : `Avstånd till green: ${Math.round(distanceToGreen)} m`}
        </Text>
        {courseId ? (
          <Pressable style={styles.editCourseButton} onPress={() => navigation.navigate('AdminCourseDetails', { courseId })}>
            <Text style={styles.editCourseButtonText}>Edit course</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Text style={styles.scoreLabel}>Antal slag</Text>
        <TextInput value={score} onChangeText={setScore} keyboardType="number-pad" placeholder="0" style={styles.scoreInput} />
        <Pressable style={styles.nextButton} onPress={() => void saveAndNext()}>
          <Text style={styles.nextButtonText}>{holeNumber >= maxHoleNumber ? 'Avsluta runda' : 'Nästa hål'}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.settingsFab} onPress={() => setSettingsVisible(true)}>
        <Text style={styles.settingsFabIcon}>⚙️</Text>
      </Pressable>

      <Modal animationType="slide" transparent visible={settingsVisible} onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setSettingsVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Inställningar</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle}>Visa fallback-bakgrundsbild</Text>
                <Text style={styles.toggleSubtitle}>Använd en demo-bild när kartan inte fungerar i development.</Text>
              </View>
              <Switch value={useFallbackBackground} onValueChange={setUseFallbackBackground} />
            </View>
            <Pressable style={styles.closeButton} onPress={() => setSettingsVisible(false)}>
              <Text style={styles.closeButtonText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { ...StyleSheet.absoluteFillObject },
  overlayTop: { paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  holeTitle: { fontSize: 30, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(15,23,42,0.7)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  holeMeta: { color: '#e2e8f0', fontWeight: '600', textShadowColor: 'rgba(15,23,42,0.7)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  distance: { color: '#fff', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(15,23,42,0.7)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  editCourseButton: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editCourseButtonText: { color: '#0f172a', fontWeight: '700' },
  controls: {
    marginTop: 'auto',
    padding: 14,
    gap: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.92)'
  },
  scoreLabel: { color: '#e2e8f0', fontWeight: '700' },
  scoreInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  nextButton: { backgroundColor: '#0f766e', borderRadius: 12, alignItems: 'center', paddingVertical: 14 },
  nextButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  settingsFab: {
    position: 'absolute',
    right: 14,
    bottom: 108,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  settingsFabIcon: { fontSize: 24 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  toggleRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  toggleTextWrap: { flex: 1, gap: 2 },
  toggleTitle: { fontWeight: '700', color: '#0f172a' },
  toggleSubtitle: { color: '#475569', fontSize: 12 },
  closeButton: { marginTop: 4, backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontWeight: '700' }
});
