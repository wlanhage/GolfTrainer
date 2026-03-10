import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LeaderboardEntry, LeaderboardFilter } from '../types/training';

type LeaderboardProps = {
  entries: LeaderboardEntry[];
  activeFilter: LeaderboardFilter;
  onChangeFilter: (filter: LeaderboardFilter) => void;
};

const FILTERS: Array<{ key: LeaderboardFilter; label: string }> = [
  { key: 'all', label: 'Alla' },
  { key: 'friends', label: 'Vänner' },
  { key: 'mine', label: 'Mina toppresultat' }
];

export function Leaderboard({ entries, activeFilter, onChangeFilter }: LeaderboardProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Leaderboard</Text>
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.key;

          return (
            <Pressable
              key={filter.key}
              onPress={() => onChangeFilter(filter.key)}
              style={[styles.filterButton, active && styles.filterButtonActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.entriesWrapper}>
        {entries.map((entry, index) => (
          <View key={entry.id} style={styles.entryRow}>
            <Text style={styles.entryRank}>{index + 1}.</Text>
            <View style={styles.entryMain}>
              <Text style={styles.entryName}>{entry.playerName}</Text>
              <Text style={styles.entryScore}>{entry.score}</Text>
            </View>
          </View>
        ))}
        {entries.length === 0 && <Text style={styles.emptyText}>Inga resultat för valt filter ännu.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  filterButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  filterButtonActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9'
  },
  filterText: {
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 12
  },
  filterTextActive: {
    color: '#ffffff'
  },
  entriesWrapper: {
    gap: 10
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  entryRank: {
    width: 18,
    color: '#6b7280',
    fontWeight: '700'
  },
  entryMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb'
  },
  entryName: {
    color: '#111827',
    fontWeight: '600'
  },
  entryScore: {
    color: '#0f766e',
    fontWeight: '700'
  },
  emptyText: {
    color: '#6b7280'
  }
});
