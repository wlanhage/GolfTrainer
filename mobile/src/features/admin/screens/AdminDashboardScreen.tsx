import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAdminApi } from '../api/adminApi';
import { AdminDrill, AdminUser } from '../types/admin';

type Subject = 'users' | 'trainings';

export function AdminDashboardScreen() {
  const adminApi = useAdminApi();
  const [subject, setSubject] = useState<Subject>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drills, setDrills] = useState<AdminDrill[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedDrill, setSelectedDrill] = useState<AdminDrill | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [homeClub, setHomeClub] = useState('');
  const [role, setRole] = useState<AdminUser['role']>('USER');

  const [drillName, setDrillName] = useState('');
  const [drillDescription, setDrillDescription] = useState('');

  const loadUsers = async () => setUsers(await adminApi.listUsers());
  const loadDrills = async () => setDrills(await adminApi.listDrills());

  useEffect(() => {
    void loadUsers();
    void loadDrills();
  }, []);

  const roles = useMemo(() => ['BASIC_USER', 'USER', 'PREMIUM_USER', 'ADMIN'] as const, []);

  const selectUser = (user: AdminUser) => {
    setSelectedUser(user);
    setRole(user.role);
    setDisplayName(user.profile?.displayName ?? '');
    setCity(user.profile?.city ?? '');
    setCountry(user.profile?.country ?? '');
    setHomeClub(user.profile?.homeClub ?? '');
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    await adminApi.updateUser(selectedUser.id, { role, displayName, city, country, homeClub });
    await loadUsers();
    Alert.alert('Sparat', 'Användaren är uppdaterad.');
  };

  const saveDrill = async () => {
    if (selectedDrill) {
      await adminApi.updateDrill(selectedDrill.id, { name: drillName, description: drillDescription });
      Alert.alert('Sparat', 'Träning uppdaterad.');
    } else {
      await adminApi.createDrill({
        name: drillName,
        description: drillDescription,
        metricType: 'SUCCESS_RATE',
        isPublic: true
      });
      Alert.alert('Sparat', 'Ny träning skapad.');
    }
    setSelectedDrill(null);
    setDrillName('');
    setDrillDescription('');
    await loadDrills();
  };

  const removeDrill = async (drillId: string) => {
    await adminApi.deleteDrill(drillId);
    await loadDrills();
    Alert.alert('Borttagen', 'Träning borttagen.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin dashboard</Text>

      <Text style={styles.label}>Välj ämne (dropdown)</Text>
      <View style={styles.dropdownRow}>
        <Pressable style={[styles.dropdownItem, subject === 'users' && styles.active]} onPress={() => setSubject('users')}>
          <Text>Användare</Text>
        </Pressable>
        <Pressable style={[styles.dropdownItem, subject === 'trainings' && styles.active]} onPress={() => setSubject('trainings')}>
          <Text>Trainings / Missions</Text>
        </Pressable>
      </View>

      {subject === 'users' ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Alla users</Text>
          {users.map((user) => (
            <Pressable key={user.id} style={styles.listItem} onPress={() => selectUser(user)}>
              <Text>{user.profile?.displayName ?? user.email}</Text>
              <Text style={styles.muted}>{user.role}</Text>
            </Pressable>
          ))}

          {selectedUser ? (
            <View style={styles.editor}>
              <Text style={styles.sectionTitle}>Redigera user</Text>
              <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" style={styles.input} />
              <TextInput value={city} onChangeText={setCity} placeholder="City" style={styles.input} />
              <TextInput value={country} onChangeText={setCountry} placeholder="Country" style={styles.input} />
              <TextInput value={homeClub} onChangeText={setHomeClub} placeholder="Home club" style={styles.input} />
              <View style={styles.dropdownRow}>
                {roles.map((r) => (
                  <Pressable key={r} style={[styles.roleChip, role === r && styles.active]} onPress={() => setRole(r)}>
                    <Text>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.primaryButton} onPress={() => void saveUser()}>
                <Text style={styles.primaryText}>Spara user</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Alla trainings/missions</Text>
          {drills.map((drill) => (
            <View key={drill.id} style={styles.listItemRow}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => {
                  setSelectedDrill(drill);
                  setDrillName(drill.name);
                  setDrillDescription(drill.description ?? '');
                }}
              >
                <Text>{drill.name}</Text>
                <Text style={styles.muted}>{drill.metricType}</Text>
              </Pressable>
              <Pressable onPress={() => void removeDrill(drill.id)}>
                <Text style={styles.deleteText}>Ta bort</Text>
              </Pressable>
            </View>
          ))}

          <View style={styles.editor}>
            <Text style={styles.sectionTitle}>{selectedDrill ? 'Redigera training' : 'Lägg till training'}</Text>
            <TextInput value={drillName} onChangeText={setDrillName} placeholder="Namn" style={styles.input} />
            <TextInput value={drillDescription} onChangeText={setDrillDescription} placeholder="Beskrivning" style={styles.input} />
            <Pressable style={styles.primaryButton} onPress={() => void saveDrill()}>
              <Text style={styles.primaryText}>{selectedDrill ? 'Uppdatera' : 'Skapa'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: '#f8fafc' },
  title: { fontSize: 28, fontWeight: '700' },
  label: { fontWeight: '600' },
  dropdownRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dropdownItem: { padding: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff' },
  active: { backgroundColor: '#dbeafe', borderColor: '#60a5fa' },
  panel: { backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 8 },
  sectionTitle: { fontWeight: '700', fontSize: 16 },
  listItem: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
  listItemRow: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { color: '#64748b', fontSize: 12 },
  editor: { marginTop: 8, gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  roleChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8 },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  deleteText: { color: '#dc2626', fontWeight: '700' }
});
