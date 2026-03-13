import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HoleLayoutGeometry } from '../types/play';

type Props = {
  geometry: HoleLayoutGeometry;
  onChange: (geometry: HoleLayoutGeometry) => void;
};

const randomPoint = () => ({ x: Math.floor(Math.random() * 100), y: Math.floor(Math.random() * 100) });

export function HoleLayoutEditor({ geometry, onChange }: Props) {
  const setTee = () => onChange({ ...geometry, teePosition: randomPoint() });
  const setGreen = () => onChange({ ...geometry, greenPosition: randomPoint() });

  const toggleSimpleShape = (field: 'waterShapes' | 'treeShapes' | 'bunkerShapes') => {
    const current = geometry[field];
    onChange({
      ...geometry,
      [field]: current.length > 0 ? [] : [[randomPoint(), randomPoint(), randomPoint()]]
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Enkel hållayout (MVP)</Text>
      <View style={styles.row}>
        <Pressable style={styles.secondaryButton} onPress={setTee}><Text>Sätt tee</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={setGreen}><Text>Sätt green</Text></Pressable>
      </View>
      <View style={styles.row}>
        <Pressable style={styles.secondaryButton} onPress={() => toggleSimpleShape('waterShapes')}><Text>Vatten</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => toggleSimpleShape('treeShapes')}><Text>Träd</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => toggleSimpleShape('bunkerShapes')}><Text>Bunker</Text></Pressable>
      </View>
      <TextInput
        style={styles.notes}
        placeholder="Layout-anteckning"
        value={geometry.notes}
        onChangeText={(notes) => onChange({ ...geometry, notes })}
      />
      <Text style={styles.summary}>Tee: {geometry.teePosition ? '✓' : '-'} • Green: {geometry.greenPosition ? '✓' : '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontWeight: '700', color: '#0f172a' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  secondaryButton: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  notes: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8 },
  summary: { color: '#475569', fontSize: 12 }
});
