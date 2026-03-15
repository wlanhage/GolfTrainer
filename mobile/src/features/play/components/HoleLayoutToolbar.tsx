import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HoleLayoutLayer } from '../types/play';

type Props = {
  activeLayer: HoleLayoutLayer;
  onLayerChange: (layer: HoleLayoutLayer) => void;
  onUndo: () => void;
  onClearLayer: () => void;
  onSave: () => void;
  canUndo: boolean;
};

const layers: { key: HoleLayoutLayer; label: string }[] = [
  { key: 'tee', label: 'TEE' },
  { key: 'green', label: 'GREEN' },
  { key: 'fairway', label: 'FAIRWAY' },
  { key: 'bunker', label: 'BUNKER' },
  { key: 'trees', label: 'TREES' },
  { key: 'ob', label: 'OB' }
];

export function HoleLayoutToolbar({ activeLayer, onLayerChange, onUndo, onClearLayer, onSave, canUndo }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.layerRow}>
        {layers.map((layer) => (
          <Pressable key={layer.key} onPress={() => onLayerChange(layer.key)} style={[styles.layerButton, activeLayer === layer.key && styles.active]}>
            <Text style={[styles.layerText, activeLayer === layer.key && styles.activeText]}>{layer.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={onUndo} disabled={!canUndo} style={[styles.actionBtn, !canUndo && styles.disabled]}><Text>Undo</Text></Pressable>
        <Pressable onPress={onClearLayer} style={styles.actionBtn}><Text>Clear active</Text></Pressable>
        <Pressable onPress={onSave} style={[styles.actionBtn, styles.saveBtn]}><Text style={{ color: '#fff' }}>Save</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  layerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionRow: { flexDirection: 'row', gap: 8 },
  layerButton: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  active: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  layerText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  activeText: { color: '#fff' },
  actionBtn: { flex: 1, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center', paddingVertical: 10 },
  saveBtn: { backgroundColor: '#0f766e' },
  disabled: { opacity: 0.5 }
});
