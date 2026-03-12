import { NativeStackScreenProps, createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminDashboardScreen } from '../../features/admin/screens/AdminDashboardScreen';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';
import { ProfileScreen } from '../../features/profile/screens/ProfileScreen';
import { TrainingListScreen } from '../../features/training/screens/TrainingListScreen';
import { TrainingMissionScreen } from '../../features/training/screens/TrainingMissionScreen';
import { useAuth } from '../../shared/store/authStore';

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

  const closeMenuThenNavigate = (route: 'TrainingList' | 'Profile' | 'AdminDashboard') => {
    navigation.goBack();
    setTimeout(() => {
      navigation.navigate(route);
    }, 0);
  };

  return (
    <View style={styles.menuScreen}>
      <Text style={styles.menuTitle}>Navigation</Text>
      <Pressable style={styles.menuItem} onPress={() => closeMenuThenNavigate('TrainingList')}>
        <Text style={styles.menuItemText}>Träning</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => closeMenuThenNavigate('Profile')}>
        <Text style={styles.menuItemText}>Profil</Text>
      </Pressable>
      {me?.role === 'ADMIN' ? (
        <Pressable style={styles.menuItem} onPress={() => closeMenuThenNavigate('AdminDashboard')}>
          <Text style={styles.menuItemText}>Admin dashboard</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.menuItem} onPress={() => navigation.goBack()}>
        <Text style={styles.menuItemText}>Stäng meny</Text>
      </Pressable>
      <Pressable
        style={[styles.menuItem, styles.dangerItem]}
        onPress={() => {
          navigation.goBack();
          void logout();
        }}
      >
        <Text style={[styles.menuItemText, styles.dangerText]}>Logga ut</Text>
      </Pressable>
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
            name="TrainingList"
            component={TrainingListScreen}
            options={({ navigation }) => ({
              headerTitle: 'GolfTrainer',
              headerLeft: () => (
                <Pressable onPress={() => navigation.navigate('Menu')} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>☰</Text>
                </Pressable>
              ),
              headerRight: () => (
                <Pressable onPress={() => navigation.navigate('Profile')} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>Profil</Text>
                </Pressable>
              )
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
              headerTitle: 'GolfTrainer',
              headerLeft: () => (
                <Pressable onPress={() => navigation.navigate('Menu')} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>☰</Text>
                </Pressable>
              ),
              headerRight: () => (
                <Pressable onPress={() => navigation.navigate('Profile')} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>Profil</Text>
                </Pressable>
              )
            })}
          />
          {me?.role === 'ADMIN' ? (
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin dashboard' }} />
          ) : null}
          <Stack.Screen
            name="Menu"
            component={MenuScreen}
            options={{ presentation: 'fullScreenModal', title: 'Meny' }}
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
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  menuScreen: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
    gap: 12
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8
  },
  menuItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff'
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600'
  },
  dangerItem: {
    borderColor: '#fecaca'
  },
  dangerText: {
    color: '#dc2626'
  }
});
