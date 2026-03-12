import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAdminApi } from '../api/adminApi';
import { AdminMission, AdminUser, MissionScoreInputType, MissionStatus } from '../types/admin';

type Subject = 'users' | 'trainings';

export function AdminDashboardScreen() {
  const adminApi = useAdminApi();
  const [subject, setSubject] = useState<Subject>('users');
  const [showDropdown, setShowDropdown] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [homeClub, setHomeClub] = useState('');
  const [role, setRole] = useState<AdminUser['role']>('USER');

  const [editingMission, setEditingMission] = useState<AdminMission | null>(null);
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [missionSlug, setMissionSlug] = useState('');
  const [missionName, setMissionName] = useState('');
  const [missionDescription, setMissionDescription] = useState('');
  const [missionIcon, setMissionIcon] = useState('🎯');
  const [missionObjective, setMissionObjective] = useState('');
  const [missionScoreLabel, setMissionScoreLabel] = useState('Poäng');
  const [missionScoreType, setMissionScoreType] = useState<MissionScoreInputType>('STEPPER');
  const [missionStepperMin, setMissionStepperMin] = useState('0');
  const [missionStepperMax, setMissionStepperMax] = useState('10');
  const [missionDefaultScore, setMissionDefaultScore] = useState('0');
  const [missionMaxScore, setMissionMaxScore] = useState('10');
  const [missionStatus, setMissionStatus] = useState<MissionStatus>('PUBLISHED');
  const [leaderboardTitle, setLeaderboardTitle] = useState('Leaderboard');
  const [leaderboardActive, setLeaderboardActive] = useState(true);

  const loadUsers = async () => setUsers(await adminApi.listUsers());
  const loadMissions = async () => setMissions(await adminApi.listMissions());

  useEffect(() => {
    void loadUsers();
    void loadMissions();
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

  const removeUser = async () => {
    if (!selectedUser) return;
    Alert.alert('Ta bort user', 'Är du säker på att du vill ta bort den här?', [
      { text: 'Nej', style: 'cancel' },
      {
        text: 'Ja',
        style: 'destructive',
        onPress: () => {
          void adminApi.updateUser(selectedUser.id, { isActive: false }).then(async () => {
            setSelectedUser(null);
            await loadUsers();
            Alert.alert('Klart', 'Användaren markerades som borttagen (inaktiv).');
          });
        }
      }
    ]);
  };

  const resetMissionForm = () => {
    setEditingMission(null);
    setMissionSlug('');
    setMissionName('');
    setMissionDescription('');
    setMissionIcon('🎯');
    setMissionObjective('');
    setMissionScoreLabel('Poäng');
    setMissionScoreType('STEPPER');
    setMissionStepperMin('0');
    setMissionStepperMax('10');
    setMissionDefaultScore('0');
    setMissionMaxScore('10');
    setMissionStatus('PUBLISHED');
    setLeaderboardTitle('Leaderboard');
    setLeaderboardActive(true);
  };

  const openCreateMission = () => {
    resetMissionForm();
    setMissionModalOpen(true);
  };

  const openEditMission = (mission: AdminMission) => {
    setEditingMission(mission);
    setMissionSlug(mission.slug);
    setMissionName(mission.name);
    setMissionDescription(mission.description);
    setMissionIcon(mission.icon);
    setMissionObjective(mission.objective);
    setMissionScoreLabel(mission.scoreLabel);
    setMissionScoreType(mission.scoreInputType);
    setMissionStepperMin(String(mission.stepperMin ?? 0));
    setMissionStepperMax(String(mission.stepperMax ?? 10));
    setMissionDefaultScore(String(mission.defaultScore ?? 0));
    setMissionMaxScore(String(mission.maxScore ?? 10));
    setMissionStatus(mission.status);
    setLeaderboardTitle(mission.leaderboard?.title ?? 'Leaderboard');
    setLeaderboardActive(mission.leaderboard?.isActive ?? true);
    setMissionModalOpen(true);
  };

  const saveMission = async () => {
    const payload = {
      slug: missionSlug,
      name: missionName,
      description: missionDescription,
      icon: missionIcon,
      objective: missionObjective,
      scoreLabel: missionScoreLabel,
      scoreInputType: missionScoreType,
      stepperMin: missionScoreType === 'STEPPER' ? Number(missionStepperMin) : undefined,
      stepperMax: missionScoreType === 'STEPPER' ? Number(missionStepperMax) : undefined,
      defaultScore: Number(missionDefaultScore),
      maxScore: Number(missionMaxScore),
      status: missionStatus,
      leaderboardTitle,
      leaderboardActive
    };

    if (editingMission) {
      await adminApi.updateMission(editingMission.id, payload);
      Alert.alert('Sparat', 'Training uppdaterad.');
    } else {
      await adminApi.createMission(payload);
      Alert.alert('Sparat', 'Ny training skapad.');
    }

    setMissionModalOpen(false);
    resetMissionForm();
    await loadMissions();
  };

  const removeMission = async (mission: AdminMission) => {
    Alert.alert('Ta bort training', 'Är du säker på att du vill ta bort den här?', [
      { text: 'Nej', style: 'cancel' },
      {
        text: 'Ja',
        style: 'destructive',
        onPress: () => {
          void adminApi.deleteMission(mission.id).then(async () => {
            await loadMissions();
            Alert.alert('Borttagen', 'Träning borttagen.');
          });
        }
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin dashboard</Text>

      <View>
        <Pressable style={styles.subjectTrigger} onPress={() => setShowDropdown((v) => !v)}>
          <Text style={styles.subjectTriggerText}>{subject === 'users' ? 'Användare' : 'Trainings / Missions'} ▾</Text>
        </Pressable>
        {showDropdown ? (
          <View style={styles.dropdownList}>
            <Pressable style={styles.dropdownListItem} onPress={() => { setSubject('users'); setShowDropdown(false); }}>
              <Text>Användare</Text>
            </Pressable>
            <Pressable style={styles.dropdownListItem} onPress={() => { setSubject('trainings'); setShowDropdown(false); }}>
              <Text>Trainings / Missions</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {subject === 'users' ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Alla users</Text>
          {users.map((user) => (
            <Pressable key={user.id} style={styles.listItem} onPress={() => selectUser(user)}>
              <Text>{user.profile?.displayName ?? user.email}</Text>
              <Text style={styles.muted}>{user.role} • {user.isActive ? 'Aktiv' : 'Inaktiv'}</Text>
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
              <View style={styles.userActionRow}>
                <Pressable style={styles.deleteUserButton} onPress={() => void removeUser()}>
                  <Text style={styles.primaryText}>Ta bort</Text>
                </Pressable>
                <Pressable style={styles.saveUserButton} onPress={() => void saveUser()}>
                  <Text style={styles.primaryText}>Spara user</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.panel}>
          <View style={styles.trainingHeader}>
            <Text style={styles.sectionTitle}>Alla trainings/missions</Text>
            <Pressable style={styles.plusButton} onPress={openCreateMission}>
              <Text style={styles.plusText}>＋</Text>
            </Pressable>
          </View>

          {missions.map((mission) => (
            <View key={mission.id} style={styles.trainingRow}>
              <Text style={styles.trainingTitle}>{mission.name}</Text>
              <View style={styles.trainingActions}>
                <Pressable onPress={() => openEditMission(mission)}>
                  <Text style={styles.actionIcon}>✏️</Text>
                </Pressable>
                <Pressable onPress={() => void removeMission(mission)}>
                  <Text style={styles.actionIcon}>❌</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={missionModalOpen} animationType="slide">
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.title}>{editingMission ? 'Redigera training' : 'Lägg till training'}</Text>
          <TextInput value={missionSlug} onChangeText={setMissionSlug} placeholder="Slug" style={styles.input} />
          <TextInput value={missionName} onChangeText={setMissionName} placeholder="Titel" style={styles.input} />
          <TextInput value={missionIcon} onChangeText={setMissionIcon} placeholder="Emoji" style={styles.input} />
          <TextInput value={missionDescription} onChangeText={setMissionDescription} placeholder="Description" style={styles.input} />
          <TextInput value={missionObjective} onChangeText={setMissionObjective} placeholder="Objective" style={styles.input} />
          <TextInput value={missionScoreLabel} onChangeText={setMissionScoreLabel} placeholder="Score label" style={styles.input} />

          <View style={styles.dropdownRow}>
            <Pressable style={[styles.roleChip, missionScoreType === 'STEPPER' && styles.active]} onPress={() => setMissionScoreType('STEPPER')}>
              <Text>Plus/minus</Text>
            </Pressable>
            <Pressable style={[styles.roleChip, missionScoreType === 'MANUAL_NUMBER' && styles.active]} onPress={() => setMissionScoreType('MANUAL_NUMBER')}>
              <Text>Skriv siffra</Text>
            </Pressable>
          </View>

          {missionScoreType === 'STEPPER' ? (
            <>
              <TextInput value={missionStepperMin} onChangeText={setMissionStepperMin} placeholder="Min" keyboardType="numeric" style={styles.input} />
              <TextInput value={missionStepperMax} onChangeText={setMissionStepperMax} placeholder="Max" keyboardType="numeric" style={styles.input} />
            </>
          ) : null}

          <TextInput value={missionDefaultScore} onChangeText={setMissionDefaultScore} placeholder="Default score" keyboardType="numeric" style={styles.input} />
          <TextInput value={missionMaxScore} onChangeText={setMissionMaxScore} placeholder="Max score" keyboardType="numeric" style={styles.input} />
          <TextInput value={leaderboardTitle} onChangeText={setLeaderboardTitle} placeholder="Leaderboard title" style={styles.input} />

          <View style={styles.dropdownRow}>
            {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((status) => (
              <Pressable key={status} style={[styles.roleChip, missionStatus === status && styles.active]} onPress={() => setMissionStatus(status)}>
                <Text>{status}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[styles.roleChip, leaderboardActive && styles.active]} onPress={() => setLeaderboardActive((v) => !v)}>
            <Text>Leaderboard aktiv</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={() => void saveMission()}>
            <Text style={styles.primaryText}>{editingMission ? 'Uppdatera' : 'Skapa'}</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setMissionModalOpen(false)}>
            <Text>Stäng</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: '#f8fafc' },
  title: { fontSize: 28, fontWeight: '700' },
  dropdownRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  panel: { backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 8 },
  sectionTitle: { fontWeight: '700', fontSize: 16 },
  listItem: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
  muted: { color: '#64748b', fontSize: 12 },
  editor: { marginTop: 8, gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  roleChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8 },
  active: { backgroundColor: '#dbeafe', borderColor: '#60a5fa' },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  userActionRow: { flexDirection: 'row', gap: 8 },
  deleteUserButton: { width: '30%', backgroundColor: '#dc2626', borderRadius: 8, padding: 12, alignItems: 'center' },
  saveUserButton: { width: '70%', backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  trainingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plusButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  trainingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
  trainingTitle: { fontWeight: '600', flex: 1 },
  trainingActions: { flexDirection: 'row', gap: 12 },
  actionIcon: { fontSize: 18 },
  modalContainer: { padding: 16, gap: 10, backgroundColor: '#fff' },
  cancelButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, alignItems: 'center' },
  subjectTrigger: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', padding: 12 },
  subjectTriggerText: { fontWeight: '600' },
  dropdownList: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', marginTop: 4 },
  dropdownListItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }
});
