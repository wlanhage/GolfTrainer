import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../shared/store/authStore';
import { useProfile } from '../hooks/useProfile';

type ProfileField = {
  label: string;
  value: string;
};

function FieldRow({ label, value }: ProfileField) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { logout } = useAuth();
  const { profile, loading, error, reload } = useProfile();

  const basics: ProfileField[] = [
    { label: 'E-post', value: profile?.email ?? '-' },
    { label: 'Namn', value: profile?.profile?.displayName ?? '-' },
    { label: 'Hemmaklubb', value: 'Bro Hof Slott GK' },
    { label: 'Ort', value: 'Stockholm' },
    { label: 'Land', value: 'Sverige' },
    { label: 'Hand', value: profile?.profile?.dominantHand === 'LEFT' ? 'Vänster' : 'Höger' }
  ];

  const golfBasics: ProfileField[] = [
    { label: 'HCP', value: profile?.profile?.handicap?.toString() ?? '18.4' },
    { label: 'Mål-HCP', value: '12.0' },
    { label: 'Spelnivå', value: 'Medel' },
    { label: 'År som golfare', value: '6' },
    { label: 'Ronder senaste 12 mån', value: '37' },
    { label: 'Träningsdagar / vecka', value: '3' },
    { label: 'Favoritklubba', value: '7-järn' },
    { label: 'Styrka', value: 'Närspel' },
    { label: 'Fokusområde', value: 'Tee precision' },
    { label: 'Mål', value: profile?.profile?.goals ?? 'Sänka HCP och slå fler fairways' }
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Min profil</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personlig information</Text>
        {basics.map((field) => (
          <View key={field.label}>
            <FieldRow label={field.label} value={field.value} />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Golfdata & hcp</Text>
        {golfBasics.map((field) => (
          <View key={field.label}>
            <FieldRow label={field.label} value={field.value} />
          </View>
        ))}
      </View>

      <View style={styles.buttons}>
        <Button title="Ladda om" onPress={() => void reload()} />
        <Button title="Logga ut" onPress={() => void logout()} color="#dc2626" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 8
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb'
  },
  label: { fontSize: 15, color: '#4b5563', flex: 1 },
  value: { fontSize: 15, color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right' },
  buttons: { marginTop: 8, gap: 10 },
  error: { color: '#dc2626' }
});
