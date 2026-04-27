import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, InputAccessoryView, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { HolePlayMap } from '../components/HolePlayMap';
import { getDistanceToGreenMeters } from '../services/holeDistance';
import { playStorage } from '../storage/playStorage';
import { GeoPoint, HoleLayoutGeometry, RoundHole } from '../types/play';
import { parseStrokes } from '../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'RoundHole'>;

const scoreInputAccessoryId = 'round-hole-score-input-accessory';

export function RoundHoleScreen({ route, navigation }: Props) {
  const { roundId, holeNumber } = route.params;
  const insets = useSafeAreaInsets();
  const scoreInputRef = useRef<TextInput>(null);
  const [roundHole, setRoundHole] = useState<RoundHole | null>(null);
  const [score, setScore] = useState('');
  const [layout, setLayout] = useState<HoleLayoutGeometry | null>(null);
  const [maxHoleNumber, setMaxHoleNumber] = useState(18);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [playerPosition, setPlayerPosition] = useState<GeoPoint | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

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
        <HolePlayMap geometry={layout} playerPosition={playerPosition} />
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
