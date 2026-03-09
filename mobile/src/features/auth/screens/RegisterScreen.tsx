import { useNavigation } from '@react-navigation/native';
import { Button, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRegisterForm } from '../hooks/useRegisterForm';

export function RegisterScreen() {
  const navigation = useNavigation();
  const {
    displayName,
    email,
    password,
    setDisplayName,
    setEmail,
    setPassword,
    submitting,
    error,
    submit
  } = useRegisterForm();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Skapa konto</Text>
      <TextInput placeholder="Namn" value={displayName} onChangeText={setDisplayName} style={styles.input} />
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
      <Button title={submitting ? 'Registrerar...' : 'Registrera'} onPress={submit} disabled={submitting} />
      <Pressable onPress={() => navigation.navigate('Login' as never)}>
        <Text style={styles.link}>Har du redan konto? Logga in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  error: { color: '#dc2626' },
  link: { textAlign: 'center', color: '#2563eb', marginTop: 8 }
});
