import { Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../shared/store/authStore';

export function HomeScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GolfTrainer</Text>
      <Text style={styles.subtitle}>Du är inloggad 🎉</Text>
      <Button title="Logga ut" onPress={() => void logout()} color="#dc2626" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, color: '#374151' }
});
