import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import { usePhoneAlerts } from '@/hooks/usePhoneAlerts';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePrefersReducedMotion } from '@/lib/motion';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  tasks: 'checkmark-circle',
  groups: 'folder-open',
  calendar: 'calendar',
  profile: 'person-circle',
};

export default function TabLayout() {
  const { user, profile, loading } = useAuth();
  const { colors, scheme } = useTheme();
  const { tasks, events } = useWorkspace();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = usePrefersReducedMotion();
  const desktop = width >= 960;
  usePhoneAlerts(Boolean(user), tasks, events);

  if (loading) return <Loading />;
  if (!user) return <Redirect href="/auth" />;
  if (profile?.onboarding_completed === false) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: reduceMotion ? 'none' : 'fade',
        transitionSpec: reduceMotion ? undefined : { animation: 'timing', config: { duration: 200 } },
        tabBarPosition: desktop ? 'left' : 'bottom',
        tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: desktop ? colors.accent : colors.onMint,
        tabBarInactiveTintColor: desktop ? '#C9DDD2' : colors.textTertiary,
        tabBarActiveBackgroundColor: desktop ? '#245445' : colors.mint,
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarStyle: desktop
          ? {
              width: 232,
              backgroundColor: scheme === 'dark' ? '#0E1C17' : '#163D32',
              borderRightColor: 'transparent',
              paddingTop: 28,
              paddingHorizontal: 12,
            }
          : {
              height: 62 + insets.bottom,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 10),
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            },
        tabBarItemStyle: desktop
          ? { borderRadius: 14, marginVertical: 3, marginHorizontal: 8, paddingHorizontal: 10, justifyContent: 'flex-start' }
          : { borderRadius: 14, marginHorizontal: 4, marginVertical: 2 },
        tabBarLabelStyle: { fontWeight: '700', fontSize: desktop ? 15 : 11 },
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
      <Tabs.Screen name="tasks" options={{ title: 'My Tasks' }} />
      <Tabs.Screen name="groups" options={{ title: 'Projects' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
