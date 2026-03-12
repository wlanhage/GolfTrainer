import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from './RootNavigator';

export type MenuNavigationRoute = 'TrainingList' | 'Profile' | 'AdminDashboard';

type MenuNavigationProp = Pick<
  NativeStackNavigationProp<AppStackParamList>,
  'goBack' | 'navigate' | 'getParent'
>;

export function navigateFromMenu(navigation: MenuNavigationProp, route: MenuNavigationRoute) {
  const rootNavigation = navigation.getParent?.<NativeStackNavigationProp<AppStackParamList>>() ?? navigation;

  rootNavigation.navigate(route);
  navigation.goBack();
}
