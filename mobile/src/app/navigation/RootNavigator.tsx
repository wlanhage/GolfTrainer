import { NativeStackScreenProps, createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminDashboardScreen } from '../../features/admin/screens/AdminDashboardScreen';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';
import { ProfileScreen } from '../../features/profile/screens/ProfileScreen';
import { TrainingListScreen } from '../../features/training/screens/TrainingListScreen';
import { TrainingMissionScreen } from '../../features/training/screens/TrainingMissionScreen';
import { useAuth } from '../../shared/store/authStore';
import { UserAvatar } from '../../shared/components/UserAvatar';
import { navigateFromMenu } from './menuNavigation';

export type AppStackParamList = {
  TrainingList: undefined;
  TrainingMission: { missionId: string };
  Profile: undefined;
  AdminDashboard: undefined;
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
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'TrainingList')}>
          <Text style={styles.menuItemText}>⛳ Träning</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'Profile')}>
          <Text style={styles.menuItemText}>👤 Profil</Text>
        </Pressable>
        {me?.role === 'ADMIN' ? (
          <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigateFromMenu(navigation, 'AdminDashboard')}>
            <Text style={styles.menuItemText}>🛠️ Admin dashboard</Text>
          </Pressable>
        ) : null}
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigation.goBack()}>
          <Text style={styles.menuItemText}>✖️ Stäng meny</Text>
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

  const renderHeaderTitle = () => (
    <View style={styles.headerTitleWrap}>
      <Text style={styles.headerTitleText}>GolfTrainer</Text>
    </View>
  );

  const renderHeaderLeft = (navigateMenu: () => void) => (
    <View style={styles.headerIconWrap}>
      <Pressable onPress={navigateMenu} style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}>
        <Text style={styles.headerButtonText}>☰</Text>
      </Pressable>
    </View>
  );

  const renderHeaderRight = (navigateProfile: () => void) => (
    <View style={styles.headerIconWrap}>
      <Pressable onPress={navigateProfile} style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}>
        <UserAvatar
          avatarImage={me?.profile?.avatarImage}
          displayName={me?.profile?.displayName}
          email={me?.email}
          size={48}
        />
      </Pressable>
    </View>
  );

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
            name="TrainingList"
            component={TrainingListScreen}
            options={({ navigation }) => ({
              headerTitle: renderHeaderTitle,
              headerLeft: () => renderHeaderLeft(() => navigation.navigate('Menu')),
              headerRight: () => renderHeaderRight(() => navigation.navigate('Profile'))
            })}
          />
          <Stack.Screen
            name="TrainingMission"
            component={TrainingMissionScreen}
            options={{ title: 'Träningsmission' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={({ navigation }) => ({
              headerTitle: renderHeaderTitle,
              headerLeft: () => renderHeaderLeft(() => navigation.navigate('Menu')),
              headerRight: () => renderHeaderRight(() => navigation.navigate('Profile'))
            })}
          />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin dashboard' }} />
          <Stack.Screen
            name="Menu"
            component={MenuScreen}
            options={{
              title: 'Meny',
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'slide_from_left',
              contentStyle: { backgroundColor: 'transparent' }
            }}
          />
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
  headerIconWrap: {
    marginTop: 8
  },
  headerTitleWrap: {
    paddingTop: 6
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  headerButton: {
    padding: 2,
    borderRadius: 999
  },
  headerButtonPressed: {
    opacity: 0.65
  },
  headerButtonText: {
    fontSize: 46,
    lineHeight: 48,
    textAlign: 'center',
    fontWeight: '500',
    color: '#1f2937'
  },
  menuOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.2)'
  },
  menuScreen: {
    width: '75%',
    maxWidth: 420,
    padding: 20,
    backgroundColor: '#f8fafc',
    gap: 12
  },
  menuBackdrop: {
    flex: 1
  },
  menuItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff'
  },
  menuItemPressed: {
    opacity: 0.72
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600'
  },
  dangerItem: {
    borderColor: '#fecaca'
  },
  logoutButton: {
    paddingVertical: 16
  },
  logoutText: {
    fontSize: 22,
    textAlign: 'center'
  },
  menuBottomSpacer: {
    flex: 1
  },
  dangerText: {
    color: '#dc2626'
  }
});
