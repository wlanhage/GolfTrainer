import { NativeStackScreenProps, createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminCourseDetailsScreen } from '../../features/admin/screens/AdminCourseDetailsScreen';
import { AdminCoursesScreen } from '../../features/admin/screens/AdminCoursesScreen';
import { AdminDashboardScreen } from '../../features/admin/screens/AdminDashboardScreen';
import { AdminHoleEditScreen } from '../../features/admin/screens/AdminHoleEditScreen';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';
import { CaddyClubDetailScreen } from '../../features/caddy/screens/CaddyClubDetailScreen';
import { CaddyClubEditGridScreen } from '../../features/caddy/screens/CaddyClubEditGridScreen';
import { CaddyClubGridScreen } from '../../features/caddy/screens/CaddyClubGridScreen';
import { AddCourseScreen } from '../../features/play/screens/AddCourseScreen';
import { CourseScorecardSetupScreen } from '../../features/play/screens/CourseScorecardSetupScreen';
import { PlayScreen } from '../../features/play/screens/PlayScreen';
import { RoundHoleScreen } from '../../features/play/screens/RoundHoleScreen';
import { RoundOverviewScreen } from '../../features/play/screens/RoundOverviewScreen';
import { ProfileScreen } from '../../features/profile/screens/ProfileScreen';
import { TrainingListScreen } from '../../features/training/screens/TrainingListScreen';
import { TrainingMissionScreen } from '../../features/training/screens/TrainingMissionScreen';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { useAuth } from '../../shared/store/authStore';
import { navigateFromMenu } from './menuNavigation';

export type AppStackParamList = {
  Play: undefined;
  AddCourse: undefined;
  CourseScorecardSetup: { courseId: string };
  RoundHole: { roundId: string; holeNumber: number };
  RoundOverview: { roundId: string };
  TrainingList: undefined;
  TrainingMission: { missionId: string };
  CaddyClubGrid: undefined;
  CaddyClubEditGrid: undefined;
  CaddyClubDetail: { clubId: string };
  Profile: undefined;
  AdminDashboard: undefined;
  AdminCourses: undefined;
  AdminCourseDetails: { courseId: string };
  AdminHoleEdit: { courseId: string; holeNumber: number };
  Menu: undefined;
  Login: undefined;
  Register: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

function MenuScreen({ navigation }: NativeStackScreenProps<AppStackParamList, 'Menu'>) {
  const { logout, me } = useAuth();

  return (
    <View style={styles.menuOverlay}>
      <View style={styles.menuScreen}>
        <Text style={styles.menuTitle}>Navigation</Text>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'Play')}>
          <Text style={styles.menuItemText}>▶️ Spela</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'TrainingList')}>
          <Text style={styles.menuItemText}>🎯 Träning</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'CaddyClubGrid')}>
          <Text style={styles.menuItemText}>🏌️ Caddy</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'Profile')}>
          <Text style={styles.menuItemText}>👤 Profil</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'AdminDashboard')}>
          <Text style={styles.menuItemText}>🛠️ Admin dashboard</Text>
        </Pressable>
        <View style={styles.menuBottomSpacer} />
        <Pressable
          style={({ pressed }) => [styles.menuItem, styles.dangerItem, styles.logoutButton, pressed && styles.menuItemPressed]}
          onPress={() => {
            navigation.goBack();
            void logout();
          }}
        >
          <Text style={[styles.menuItemText, styles.dangerText, styles.logoutText]}>Logga ut</Text>
        </Pressable>
      </View>
      <Pressable style={styles.menuBackdrop} onPress={() => navigation.goBack()} />
    </View>
  );
}

export function RootNavigator() {
  const { status, me } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {status === 'authenticated' ? (
        <>
          <Stack.Screen
            name="Play"
            component={PlayScreen}
            options={({ navigation }) => ({
              title: 'Spela',
              headerLeft: () => (
                <Pressable onPress={() => navigation.navigate('Menu')} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>☰</Text>
                </Pressable>
              ),
              headerRight: () => (
                <Pressable android_ripple={{ color: 'transparent' }} onPress={() => navigation.navigate('Profile')} style={styles.profileHeaderButton}>
                  <UserAvatar avatarImage={me?.profile?.avatarImage} displayName={me?.profile?.displayName} email={me?.email} size={40} />
                </Pressable>
              )
            })}
          />
          <Stack.Screen name="AddCourse" component={AddCourseScreen} options={{ title: 'Lägg till bana' }} />
          <Stack.Screen name="CourseScorecardSetup" component={CourseScorecardSetupScreen} options={{ title: 'Scorekort' }} />
          <Stack.Screen name="RoundHole" component={RoundHoleScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RoundOverview" component={RoundOverviewScreen} options={{ title: 'Översikt' }} />
          <Stack.Screen name="TrainingList" component={TrainingListScreen} options={{ title: 'Träning' }} />
          <Stack.Screen name="TrainingMission" component={TrainingMissionScreen} options={{ title: 'Träningsmission' }} />
          <Stack.Screen name="CaddyClubGrid" component={CaddyClubGridScreen} options={{ title: 'Caddy' }} />
          <Stack.Screen name="CaddyClubEditGrid" component={CaddyClubEditGridScreen} options={{ title: 'Edit caddy' }} />
          <Stack.Screen name="CaddyClubDetail" component={CaddyClubDetailScreen} options={{ title: 'Klubbdata' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin dashboard' }} />
          <Stack.Screen name="AdminCourses" component={AdminCoursesScreen} options={{ title: 'Admin banor' }} />
          <Stack.Screen name="AdminCourseDetails" component={AdminCourseDetailsScreen} options={{ title: 'Bana detaljer' }} />
          <Stack.Screen name="AdminHoleEdit" component={AdminHoleEditScreen} options={{ title: 'Redigera hål' }} />
          <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false, presentation: 'transparentModal' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Registrera' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerButton: { padding: 4 },
  profileHeaderButton: { padding: 0, borderWidth: 0, backgroundColor: 'transparent', outlineWidth: 0 },
  headerButtonText: { fontSize: 34, lineHeight: 34 },
  menuOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(15, 23, 42, 0.2)' },
  menuScreen: { width: '75%', maxWidth: 420, padding: 20, backgroundColor: '#f8fafc', gap: 12 },
  menuBackdrop: { flex: 1 },
  menuTitle: { fontSize: 20, fontWeight: '700' },
  menuItem: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#ffffff' },
  menuItemPressed: { opacity: 0.72 },
  menuItemText: { fontSize: 16, color: '#111827', fontWeight: '600' },
  dangerItem: { borderColor: '#fecaca' },
  logoutButton: { paddingVertical: 16 },
  logoutText: { fontSize: 22, textAlign: 'center' },
  menuBottomSpacer: { flex: 1 },
  dangerText: { color: '#dc2626' }
});
