import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { useCaddyApi } from '../api/caddyApi';
import { caddyClubs } from '../data/caddyClubs';
import { CaddyClubSummary } from '../types/caddy';

type Props = NativeStackScreenProps<AppStackParamList, 'CaddyClubGrid'>;

export function CaddyClubGridScreen({ navigation }: Props) {
  const caddyApi = useCaddyApi();
  const [summaries, setSummaries] = useState<CaddyClubSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        const response = await caddyApi.listClubSummaries();
        if (active) {
          setSummaries(response);
        }
      };

      void run();

      return () => {
        active = false;
      };
    }, [caddyApi])
  );

  const byClubKey = useMemo(() => new Map(summaries.map((item) => [item.clubKey, item])), [summaries]);
  const clubsWithData = useMemo(
    () =>
      caddyClubs
        .map((club) => ({ club, summary: byClubKey.get(club.id) }))
        .filter((item): item is { club: (typeof caddyClubs)[number]; summary: CaddyClubSummary } => Boolean(item.summary?.sampleCount)),
    [byClubKey]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Caddy</Text>
        <Pressable style={styles.editButton} onPress={() => navigation.navigate('CaddyClubEditGrid')}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Klubbor med inlagda slag, sorterade från driver och neråt.</Text>

      <View style={styles.list}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.nameCell]}>Namn</Text>
          <Text style={styles.headerCell}>Längd</Text>
          <Text style={styles.headerCell}>Spridning</Text>
          <Text style={styles.headerCell}>Höjd</Text>
        </View>

        {clubsWithData.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Inga klubbor med inlagda slag ännu.</Text>
            <Pressable style={styles.emptyEditButton} onPress={() => navigation.navigate('CaddyClubEditGrid')}>
              <Text style={styles.emptyEditButtonText}>Lägg till slag</Text>
            </Pressable>
          </View>
        ) : (
          clubsWithData.map(({ club, summary }) => (
            <Pressable
              key={club.id}
              style={styles.clubRow}
              onPress={() => navigation.navigate('CaddyClubDetail', { clubId: club.id })}
            >
              <Text style={[styles.clubCell, styles.nameCell, styles.clubName]} numberOfLines={1}>
                {club.name}
              </Text>
              <Text style={styles.clubCell}>{formatMeters(summary.distanceMeters)}</Text>
              <Text style={styles.clubCell}>{formatSide(summary.lateralOffsetMeters)}</Text>
              <Text style={styles.clubCell}>{formatMeters(summary.peakHeightMeters)}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const formatMeters = (value: number | undefined) => {
  if (value === undefined) {
    return '-';
  }

  return `${Math.round(value)} m`;
};

const formatSide = (value: number | undefined) => {
  if (value === undefined) {
    return '-';
  }

  const rounded = Math.round(Math.abs(value));
  if (rounded === 0) {
    return '0';
  }

  return `${rounded}${value < 0 ? 'v' : 'h'}`;
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f1f5f9',
    flexGrow: 1,
    gap: 8
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827'
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  editButtonText: {
    color: '#0f172a',
    fontWeight: '800'
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 8
  },
  list: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  headerCell: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right'
  },
  nameCell: {
    flex: 1.25,
    textAlign: 'left'
  },
  clubRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0'
  },
  clubCell: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right'
  },
  clubName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827'
  },
  emptyCard: {
    padding: 16,
    gap: 12,
    alignItems: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center'
  },
  emptyEditButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  emptyEditButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  }
});
