import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { HoleHeader } from '../components/HoleHeader';
import { HoleLayoutEditor } from '../components/HoleLayoutEditor';
import { HoleMetaForm } from '../components/HoleMetaForm';
import { HoleScoreInput } from '../components/HoleScoreInput';
import { getDistanceToGreenMeters } from '../services/holeDistance';
import { playStorage } from '../storage/playStorage';
import { GeoPoint, HoleLayoutGeometry, RoundHole } from '../types/play';
import { parseOptionalHcpIndex, parseOptionalPositiveNumber, parseStrokes } from '../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'RoundHole'>;

export function RoundHoleScreen({ route, navigation }: Props) {
  const { roundId, holeNumber } = route.params;
  const [roundHole, setRoundHole] = useState<RoundHole | null>(null);
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');
  const [meta, setMeta] = useState({ par: '', length: '', hcpIndex: '' });
  const [layout, setLayout] = useState<HoleLayoutGeometry | null>(null);
  const [maxHoleNumber, setMaxHoleNumber] = useState(18);
  const [playerPosition, setPlayerPosition] = useState<GeoPoint | null>(null);

  const load = () => {
    playStorage.getRoundHole(roundId, holeNumber).then((result) => {
      if (!result) return;
      setRoundHole(result.roundHole);
      setScore(result.roundHole.strokes?.toString() ?? '');
      setNotes(result.roundHole.notes ?? '');
      setMeta({
        par: result.hole?.par?.toString() ?? '',
        length: result.hole?.length?.toString() ?? '',
        hcpIndex: result.hole?.hcpIndex?.toString() ?? ''
      });
      setLayout(result.layout?.geometry ?? null);
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
    return <View style={styles.loading}><Text>Laddar hål...</Text></View>;
  }

  const saveMeta = async () => {
    try {
      await playStorage.updateHoleMeta(roundHole.holeId, {
        par: parseOptionalPositiveNumber(meta.par),
        length: parseOptionalPositiveNumber(meta.length),
        hcpIndex: parseOptionalHcpIndex(meta.hcpIndex)
      });
      load();
    } catch (error) {
      Alert.alert('Kunde inte spara metadata', (error as Error).message);
    }
  };

  const saveLayout = async () => {
    await playStorage.updateHoleLayout(roundHole.holeId, layout);
    Alert.alert('Sparat', 'Layout sparad.');
  };

  const saveAndNext = async () => {
    const parsedStrokes = parseStrokes(score);
    if (score.trim() && parsedStrokes === null) {
      return Alert.alert('Felaktigt resultat', 'Ange ett heltal som är 0 eller större.');
    }

    await playStorage.saveRoundHoleScore(roundId, holeNumber, parsedStrokes, notes);
    await playStorage.updateHoleLayout(roundHole.holeId, layout);

    if (holeNumber >= maxHoleNumber) {
      await playStorage.completeRound(roundId);
      navigation.replace('RoundOverview', { roundId });
      return;
    }

    await playStorage.setCurrentHole(roundId, holeNumber + 1);
    navigation.replace('RoundHole', { roundId, holeNumber: holeNumber + 1 });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <HoleHeader holeNumber={roundHole.holeNumber} par={roundHole.parSnapshot} length={roundHole.lengthSnapshot} hcpIndex={roundHole.hcpIndexSnapshot} />
      <HoleScoreInput value={score} onChange={setScore} />
      <HoleMetaForm
        par={meta.par}
        length={meta.length}
        hcpIndex={meta.hcpIndex}
        onChange={(field, value) => setMeta((prev) => ({ ...prev, [field]: value }))}
        onSave={saveMeta}
      />

      <View style={styles.layoutHeader}>
        <Text style={styles.sectionTitle}>Hole layout</Text>
        <Pressable style={styles.secondaryAction} onPress={() => void saveLayout()}>
          <Text style={styles.secondaryActionText}>Edit layout</Text>
        </Pressable>
      </View>
      <Text style={styles.distance}>
        {distanceToGreen === null ? 'Avstånd till green: saknas layout eller GPS' : `Avstånd till green: ${Math.round(distanceToGreen)} m`}
      </Text>
      <HoleLayoutEditor geometry={layout} onChange={setLayout} onSave={() => void saveLayout()} />

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('RoundOverview', { roundId })}>
          <Text style={styles.secondaryActionText}>Översikt</Text>
        </Pressable>
        {holeNumber > 1 ? (
          <Pressable
            style={styles.secondaryAction}
            onPress={async () => {
              await playStorage.setCurrentHole(roundId, holeNumber - 1);
              navigation.replace('RoundHole', { roundId, holeNumber: holeNumber - 1 });
            }}
          >
            <Text style={styles.secondaryActionText}>Föregående</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.primaryAction} onPress={() => void saveAndNext()}>
        <Text style={styles.primaryActionText}>{holeNumber >= maxHoleNumber ? 'Avsluta runda' : 'Spara och nästa hål'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 14, backgroundColor: '#f1f5f9' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: 8 },
  secondaryAction: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#94a3b8', alignItems: 'center', paddingVertical: 12, backgroundColor: '#fff' },
  secondaryActionText: { fontWeight: '700', color: '#1e293b' },
  primaryAction: { borderRadius: 12, alignItems: 'center', backgroundColor: '#0f766e', paddingVertical: 14 },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  layoutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontWeight: '700', color: '#0f172a' },
  distance: { color: '#334155', fontSize: 13 }
});
