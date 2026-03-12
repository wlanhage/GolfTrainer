import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { useCaddyApi } from '../api/caddyApi';
import { caddyClubs } from '../data/caddyClubs';
import { CaddyClubSummary, CaddyShot, CaddyShotInput, emptyShotInput } from '../types/caddy';
import { CaddyLandingHeatmap } from '../components/CaddyLandingHeatmap';

type Props = NativeStackScreenProps<AppStackParamList, 'CaddyClubDetail'>;

export function CaddyClubDetailScreen({ route }: Props) {
  const { clubId } = route.params;
  const caddyApi = useCaddyApi();

  const club = useMemo(() => caddyClubs.find((item) => item.id === clubId), [clubId]);
  const [form, setForm] = useState<CaddyShotInput>(emptyShotInput);
  const [shots, setShots] = useState<CaddyShot[]>([]);
  const [summary, setSummary] = useState<CaddyClubSummary | null>(null);

  const refresh = useCallback(async () => {
    const [nextShots, summaries] = await Promise.all([caddyApi.listShotsForClub(clubId), caddyApi.listClubSummaries()]);
    setShots(nextShots);
    setSummary(summaries.find((item) => item.clubKey === clubId) ?? null);
  }, [caddyApi, clubId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onChange = (field: keyof CaddyShotInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onAddShot = async () => {
    const distance = Number(form.distanceMeters);
    const lateralOffset = Number(form.lateralOffsetMeters);
    const height = form.peakHeightMeters.trim() ? Number(form.peakHeightMeters) : undefined;
    const spin = form.spinRpm.trim() ? Number(form.spinRpm) : undefined;

    if (!form.distanceMeters.trim() || Number.isNaN(distance) || distance <= 0) {
      Alert.alert('Ogiltig längd', 'Längd (meter) är obligatorisk och måste vara större än 0.');
      return;
    }

    if (!form.lateralOffsetMeters.trim() || Number.isNaN(lateralOffset)) {
      Alert.alert('Ogiltig spridning', 'Höger-vänster (meter) är obligatorisk för varje slag.');
      return;
    }

    if (form.peakHeightMeters.trim() && Number.isNaN(height)) {
      Alert.alert('Ogiltig höjd', 'Höjd måste vara ett nummer.');
      return;
    }

    if (form.spinRpm.trim() && Number.isNaN(spin)) {
      Alert.alert('Ogiltig spinn', 'Spinn måste vara ett nummer.');
      return;
    }

    await caddyApi.addShot(clubId, {
      distanceMeters: distance,
      lateralOffsetMeters: lateralOffset,
      peakHeightMeters: height,
      spinRpm: spin
    });

    setForm(emptyShotInput());
    await refresh();
  };

  const onDeleteShot = async (shotId: string) => {
    await caddyApi.removeShot(shotId);
    await refresh();
  };


  const heatmapPoints = useMemo(() => {
    const centerDistance = summary?.distanceMeters ?? (shots.length > 0
      ? shots.reduce((sum, shot) => sum + shot.distanceMeters, 0) / shots.length
      : 0);

    return shots.map((shot) => ({
      x: shot.lateralOffsetMeters,
      y: shot.distanceMeters - centerDistance
    }));
  }, [shots, summary?.distanceMeters]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{club?.name ?? 'Klubba'}</Text>
        <Pressable
          style={styles.importButton}
          onPress={() => Alert.alert('Kommer snart', 'Importera slag är inte implementerat ännu.')}
        >
          <Text style={styles.importButtonText}>Importera slag</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Data sparas i backend och summeras automatiskt från inmatade slag.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lägg till slag</Text>
        <Field
          label="Längd (meter)"
          required
          value={form.distanceMeters}
          onChangeText={(value) => onChange('distanceMeters', value)}
          placeholder="t.ex. 154"
        />
        <Field
          label="Höger-vänster (meter)"
          required
          value={form.lateralOffsetMeters}
          onChangeText={(value) => onChange('lateralOffsetMeters', value)}
          placeholder="negativt = vänster, positivt = höger"
        />
        <Field
          label="Höjd (meter)"
          value={form.peakHeightMeters}
          onChangeText={(value) => onChange('peakHeightMeters', value)}
          placeholder="valfritt"
        />
        <Field
          label="Spinn (rpm)"
          value={form.spinRpm}
          onChangeText={(value) => onChange('spinRpm', value)}
          placeholder="valfritt"
        />

        <Pressable style={styles.primaryButton} onPress={() => void onAddShot()}>
          <Text style={styles.primaryButtonText}>Lägg till slag</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sammanfattning ({summary?.sampleCount ?? 0} slag)</Text>
        <Text style={styles.trimText}>
          Trimning: {summary?.trimPercentEachSide ?? 0}% per sida ({summary?.trimmedSampleCount ?? 0} slag kvar)
        </Text>
        <SummaryRow label="Längd" value={format(summary?.distanceMeters, 'm')} required />
        <SummaryRow label="Spridning höger-vänster" value={format(summary?.dispersionMeters, 'm')} required />
        <SummaryRow label="Höjd" value={format(summary?.peakHeightMeters, 'm')} />
        <SummaryRow label="Spinn" value={format(summary?.spinRpm, 'rpm')} />
      </View>



      <View style={styles.card}>
        <Text style={styles.cardTitle}>Landnings-heatmap</Text>
        <CaddyLandingHeatmap
          points={heatmapPoints}
          onCellPress={(cell) =>
            Alert.alert('Ruta', `${cell.count} slag i rutan (${cell.percentage}%).`)
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Inmatade slag</Text>
        {shots.length === 0 ? (
          <Text style={styles.emptyText}>Inga slag registrerade ännu.</Text>
        ) : (
          shots.map((shot, index) => (
            <View key={shot.id} style={styles.shotRow}>
              <Text style={styles.shotText}>
                #{shots.length - index} · {shot.distanceMeters} m · {shot.lateralOffsetMeters} m sidled
              </Text>
              <Pressable onPress={() => void onDeleteShot(shot.id)}>
                <Text style={styles.deleteText}>Ta bort</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  required?: boolean;
};

function Field({ label, value, onChangeText, placeholder, required = false }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder={placeholder}
        style={styles.input}
      />
    </View>
  );
}

function SummaryRow({ label, value, required = false }: { label: string; value: string; required?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const format = (value: number | undefined, unit: string) => {
  if (value === undefined) {
    return 'Saknas';
  }

  return `${value.toFixed(1)} ${unit}`;
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f1f5f9',
    flexGrow: 1,
    gap: 12
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827'
  },
  importButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  importButtonText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563'
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 10
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  trimText: {
    fontSize: 12,
    color: '#6b7280'
  },
  fieldWrap: {
    gap: 6
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff'
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryLabel: {
    fontSize: 14,
    color: '#374151'
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827'
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14
  },
  shotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  shotText: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
    marginRight: 8
  },
  deleteText: {
    color: '#dc2626',
    fontWeight: '600'
  }
});
