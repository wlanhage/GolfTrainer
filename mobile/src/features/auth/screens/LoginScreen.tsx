import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLoginForm } from '../hooks/useLoginForm';

export function LoginScreen() {
  const { email, password, setEmail, setPassword, submitting, error, submit } = useLoginForm();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GolfTrainer</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="E-post"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Lösenord"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={submitting ? 'Loggar in...' : 'Logga in'} onPress={submit} disabled={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  error: { color: '#dc2626' }
});
