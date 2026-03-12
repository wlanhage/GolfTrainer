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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Caddy</Text>
      <Text style={styles.subtitle}>5% trim per sida används automatiskt när klubban har fler än 20 slag.</Text>

      <View style={styles.grid}>
        {caddyClubs.map((club) => {
          const summary = byClubKey.get(club.id);

          return (
            <Pressable
              key={club.id}
              style={styles.clubCard}
              onPress={() => navigation.navigate('CaddyClubDetail', { clubId: club.id })}
            >
              <Text style={styles.clubName}>{club.name}</Text>
              <Text style={styles.clubMeta}>{summary?.sampleCount ?? 0} slag</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f1f5f9',
    flexGrow: 1,
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827'
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 8
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  clubCard: {
    width: '31%',
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 4
  },
  clubName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center'
  },
  clubMeta: {
    fontSize: 12,
    color: '#6b7280'
  }
});
