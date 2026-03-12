import { ActivityIndicator, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useAuth } from '../../../shared/store/authStore';
import { useProfile } from '../hooks/useProfile';
import { UpdateProfileInput } from '../types/profile';
import { UserAvatar } from '../../../shared/components/UserAvatar';

type EditableFieldProps = {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  saving: boolean;
};

type DisplayField = {
  label: string;
  value: string;
  editable?: boolean;
  field?: keyof UpdateProfileInput;
};

function EditableField({ label, value, onSave, saving }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Pressable onPress={startEdit}>
          <TextInput
            style={[styles.input, !editing && styles.inputReadOnly]}
            value={editing ? draft : value}
            editable={editing && !saving}
            onChangeText={setDraft}
            onBlur={() => !saving && setEditing(false)}
          />
        </Pressable>
        {editing ? (
          <View style={styles.iconActions}>
            <Pressable
              disabled={saving}
              onPress={() => {
                setDraft(value);
                setEditing(false);
              }}>
              <Text style={styles.cancel}>✕</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={() => {
                void onSave(draft).then(() => setEditing(false));
              }}>
              <Text style={styles.confirm}>✓</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { logout } = useAuth();
  const { profile, loading, error, reload, saveField, savingField } = useProfile();

  const profileData = profile?.profile;

  const basics: DisplayField[] = useMemo(
    () => [
      { label: 'E-post', value: profile?.email ?? '-', editable: false },
      { label: 'Namn', value: profileData?.displayName ?? '', field: 'displayName' },
      { label: 'Profilbild (URL)', value: profileData?.avatarImage ?? '', field: 'avatarImage' },
      { label: 'Hemmaklubb', value: profileData?.homeClub ?? '', field: 'homeClub' },
      { label: 'Ort', value: profileData?.city ?? '', field: 'city' },
      { label: 'Land', value: profileData?.country ?? '', field: 'country' },
      {
        label: 'Hand',
        value: profileData?.dominantHand === 'LEFT' ? 'LEFT' : 'RIGHT',
        field: 'dominantHand'
      }
    ],
    [profile?.email, profileData]
  );

  const golfBasics: DisplayField[] = useMemo(
    () => [
      { label: 'HCP', value: profileData?.handicap?.toString() ?? '', field: 'handicap' },
      { label: 'Mål-HCP', value: profileData?.targetHandicap?.toString() ?? '', field: 'targetHandicap' },
      { label: 'Spelnivå', value: profileData?.skillLevel ?? '', field: 'skillLevel' },
      { label: 'År som golfare', value: profileData?.yearsPlaying?.toString() ?? '', field: 'yearsPlaying' },
      {
        label: 'Ronder senaste 12 mån',
        value: profileData?.roundsLast12Months?.toString() ?? '',
        field: 'roundsLast12Months'
      },
      {
        label: 'Träningsdagar / vecka',
        value: profileData?.trainingDaysPerWeek?.toString() ?? '',
        field: 'trainingDaysPerWeek'
      },
      { label: 'Favoritklubba', value: profileData?.favoriteClub ?? '', field: 'favoriteClub' },
      { label: 'Styrka', value: profileData?.strengthArea ?? '', field: 'strengthArea' },
      { label: 'Fokusområde', value: profileData?.focusArea ?? '', field: 'focusArea' },
      { label: 'Mål', value: profileData?.goals ?? '', field: 'goals' }
    ],
    [profileData]
  );

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

      <View style={styles.avatarBlock}>
        <UserAvatar
          avatarImage={profileData?.avatarImage}
          displayName={profileData?.displayName}
          email={profile?.email}
          size={100}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personlig information</Text>
        {basics.map((field) =>
          field.editable === false ? (
            <View key={field.label} style={styles.row}>
              <Text style={styles.label}>{field.label}</Text>
              <Text style={styles.value}>{field.value}</Text>
            </View>
          ) : (
            <EditableField
              key={field.label}
              label={field.label}
              value={field.value}
              saving={savingField === field.field}
              onSave={(value) => saveField(field.field as keyof UpdateProfileInput, value)}
            />
          )
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Golfdata & hcp</Text>
        {golfBasics.map((field) => (
          <EditableField
            key={field.label}
            label={field.label}
            value={field.value}
            saving={savingField === field.field}
            onSave={(value) => saveField(field.field as keyof UpdateProfileInput, value)}
          />
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
  avatarBlock: { alignItems: 'center', gap: 10, marginBottom: 6 },
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
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb'
  },
  label: { fontSize: 15, color: '#4b5563', flex: 1 },
  value: { fontSize: 15, color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  input: {
    minWidth: 120,
    textAlign: 'right',
    color: '#111827',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  inputReadOnly: {
    borderColor: 'transparent',
    backgroundColor: 'transparent'
  },
  iconActions: { flexDirection: 'row', gap: 8 },
  confirm: { color: '#16a34a', fontSize: 18, fontWeight: '700' },
  cancel: { color: '#dc2626', fontSize: 18, fontWeight: '700' },
  buttons: { marginTop: 8, gap: 10 },
  error: { color: '#dc2626' }
});
