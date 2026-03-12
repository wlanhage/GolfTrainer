import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from './RootNavigator';

export type MenuNavigationRoute = 'TrainingList' | 'Profile' | 'AdminDashboard';

type MenuNavigationProp = Pick<
  NativeStackNavigationProp<AppStackParamList>,
  'goBack' | 'navigate' | 'getParent'
>;

type ScheduleNavigation = (cb: () => void) => void;

export function navigateFromMenu(
  navigation: MenuNavigationProp,
  route: MenuNavigationRoute,
  scheduleNavigation: ScheduleNavigation = (cb) => {
    setTimeout(cb, 0);
  }
) {
  const rootNavigation = navigation.getParent?.<NativeStackNavigationProp<AppStackParamList>>() ?? navigation;

  if (rootNavigation === navigation) {
    navigation.goBack();
    scheduleNavigation(() => navigation.navigate(route));
    return;
  }

  rootNavigation.navigate(route);
  navigation.goBack();
}
