import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
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
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'GolfTrainer' }} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Registrera' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
