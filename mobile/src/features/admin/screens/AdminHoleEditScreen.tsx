import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { HoleHeader } from '../../play/components/HoleHeader';
import { HoleLayoutEditor } from '../../play/components/HoleLayoutEditor';
import { HoleMetaForm } from '../../play/components/HoleMetaForm';
import { playStorage } from '../../play/storage/playStorage';
import { HoleLayoutGeometry } from '../../play/types/play';
import { parseOptionalHcpIndex, parseOptionalPositiveNumber } from '../../play/utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'AdminHoleEdit'>;

export function AdminHoleEditScreen({ route, navigation }: Props) {
  const { courseId, holeNumber } = route.params;
  const [maxHoleNumber, setMaxHoleNumber] = useState(18);
  const [holeId, setHoleId] = useState<string | null>(null);
  const [meta, setMeta] = useState({ par: '', length: '', hcpIndex: '' });
  const [layout, setLayout] = useState<HoleLayoutGeometry | null>(null);

  const load = useCallback(() => {
    playStorage.getCourseWithHoles(courseId).then((result) => {
      if (!result) return;
      setMaxHoleNumber(result.holes.length);
    });

    playStorage.getHoleWithLayout(courseId, holeNumber).then((result) => {
      if (!result) return;
      setHoleId(result.hole.id);
      setMeta({
        par: result.hole.par?.toString() ?? '',
        length: result.hole.length?.toString() ?? '',
        hcpIndex: result.hole.hcpIndex?.toString() ?? ''
      });
      setLayout(result.layout.geometry);
    });
  }, [courseId, holeNumber]);

  useEffect(() => {
    load();
  }, [load]);

  if (!holeId || !layout) {
    return <View style={styles.center}><Text>Laddar hål...</Text></View>;
  }

  const save = async () => {
    try {
      await playStorage.updateHoleMeta(holeId, {
        par: parseOptionalPositiveNumber(meta.par),
        length: parseOptionalPositiveNumber(meta.length),
        hcpIndex: parseOptionalHcpIndex(meta.hcpIndex)
      });
      await playStorage.updateHoleLayout(holeId, layout);
      Alert.alert('Sparat', `Hål ${holeNumber} uppdaterat.`);
    } catch (error) {
      Alert.alert('Kunde inte spara hål', (error as Error).message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <HoleHeader
        holeNumber={holeNumber}
        par={meta.par.trim() ? Number(meta.par) : null}
        length={meta.length.trim() ? Number(meta.length) : null}
        hcpIndex={meta.hcpIndex.trim() ? Number(meta.hcpIndex) : null}
      />
      <HoleMetaForm
        par={meta.par}
        length={meta.length}
        hcpIndex={meta.hcpIndex}
        onChange={(field, value) => setMeta((prev) => ({ ...prev, [field]: value }))}
        onSave={() => void save()}
      />
      <HoleLayoutEditor geometry={layout} onChange={setLayout} />

      <View style={styles.row}>
        <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('AdminCourseDetails', { courseId })}>
          <Text style={styles.secondaryActionText}>Tillbaka till bana</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        {holeNumber > 1 ? (
          <Pressable style={styles.secondaryAction} onPress={() => navigation.replace('AdminHoleEdit', { courseId, holeNumber: holeNumber - 1 })}>
            <Text style={styles.secondaryActionText}>Föregående</Text>
          </Pressable>
        ) : null}
        {holeNumber < maxHoleNumber ? (
          <Pressable style={styles.secondaryAction} onPress={() => navigation.replace('AdminHoleEdit', { courseId, holeNumber: holeNumber + 1 })}>
            <Text style={styles.secondaryActionText}>Nästa</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.primaryAction} onPress={() => void save()}>
        <Text style={styles.primaryActionText}>Spara hål</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 14, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  secondaryAction: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#94a3b8', alignItems: 'center', paddingVertical: 12, backgroundColor: '#fff' },
  secondaryActionText: { fontWeight: '700', color: '#1e293b' },
  primaryAction: { borderRadius: 12, alignItems: 'center', backgroundColor: '#0f766e', paddingVertical: 14 },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
