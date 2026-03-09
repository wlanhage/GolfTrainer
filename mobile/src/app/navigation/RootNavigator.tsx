import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { ProfileScreen } from '../../features/profile/screens/ProfileScreen';
import { useAuth } from '../../shared/store/authStore';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { status } = useAuth();

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
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'GolfTrainer' }} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}
