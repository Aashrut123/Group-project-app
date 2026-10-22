import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePhoneAlerts } from '@/hooks/usePhoneAlerts';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePrefersReducedMotion } from '@/lib/motion';
import { theme } from '@/lib/theme';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  calendar: 'calendar',
  groups: 'folder-open',
  tasks: 'checkmark-circle',
  profile: 'person-circle',
};

export default function TabLayout() {
  const { user, profile, loading } = useAuth();
  const { tasks, events } = useWorkspace();
  const { width } = useWindowDimensions();
  const reduceMotion = usePrefersReducedMotion();
  const desktop = width >= 960;
  usePhoneAlerts(Boolean(user), tasks, events);

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Redirect href="/auth" />;
  }

  if (profile?.onboarding_completed === false) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: reduceMotion ? 'none' : 'fade',
        transitionSpec: reduceMotion ? undefined : { animation: 'timing', config: { duration: 200 } },
        tabBarPosition: desktop ? 'left' : 'bottom',
        tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.faint,
        tabBarActiveBackgroundColor: desktop ? theme.colors.mint : 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarStyle: desktop
          ? {
              width: 232,
              backgroundColor: theme.colors.surface,
              borderRightColor: theme.colors.line,
              paddingTop: 18,
              paddingHorizontal: 12,
            }
          : {
              height: 84,
              paddingTop: 9,
              paddingBottom: 18,
              borderTopColor: theme.colors.line,
              backgroundColor: theme.colors.surface,
            },
        tabBarItemStyle: desktop
          ? {
              borderRadius: 12,
              marginVertical: 2,
              paddingHorizontal: 10,
              justifyContent: 'flex-start',
            }
          : undefined,
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: desktop ? 14 : 10,
        },
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons
            name={focused ? icons[route.name] : `${icons[route.name]}-outline` as keyof typeof Ionicons.glyphMap}
            size={desktop ? 22 : size}
            color={color}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="groups" options={{ title: 'Projects' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
