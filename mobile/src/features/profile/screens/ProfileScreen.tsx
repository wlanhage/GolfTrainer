import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../shared/store/authStore';
import { useProfile } from '../hooks/useProfile';

export function ProfileScreen() {
  const { logout } = useAuth();
  const { profile, loading, error, reload } = useProfile();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Min profil</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.item}>E-post: {profile?.email ?? '-'}</Text>
      <Text style={styles.item}>Namn: {profile?.profile?.displayName ?? '-'}</Text>
      <Text style={styles.item}>Hand: {profile?.profile?.dominantHand ?? '-'}</Text>
      <Text style={styles.item}>HCP: {profile?.profile?.handicap ?? '-'}</Text>
      <Text style={styles.item}>Mål: {profile?.profile?.goals ?? '-'}</Text>

      <View style={styles.buttons}>
        <Button title="Ladda om" onPress={() => void reload()} />
        <Button title="Logga ut" onPress={() => void logout()} color="#dc2626" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 10 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 10 },
  item: { fontSize: 16 },
  buttons: { marginTop: 20, gap: 10 },
  error: { color: '#dc2626' }
});
