import { Redirect, Tabs } from 'expo-router';
import { Text, View } from 'react-native';

import { Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePhoneAlerts } from '@/hooks/usePhoneAlerts';
import { useWorkspace } from '@/hooks/useWorkspace';
import { theme } from '@/lib/theme';

const glyph: Record<string, string> = {
  index: '⌂',
  calendar: '▦',
  groups: '◎',
  tasks: '✓',
  profile: '◉',
};

export default function TabLayout() {
  const { user, profile, loading } = useAuth();
  const { tasks, events } = useWorkspace();
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
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.faint,

        tabBarStyle: {
          height: 84,
          paddingTop: 9,
          paddingBottom: 18,
          borderTopColor: theme.colors.line,
          backgroundColor: 'white',
        },

        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 10,
        },

        tabBarIcon: ({ color, focused }) => (
          <View
            style={{
              minWidth: 40,
              height: 28,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? theme.colors.mint : 'transparent',
            }}
          >
            <Text
              style={{
                color,
                fontSize: 18,
                fontWeight: focused ? '800' : '600',
              }}
            >
              {glyph[route.name] || '·'}
            </Text>
          </View>
        ),
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar' }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: 'Projects' }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: 'Tasks' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
    </Tabs>
  );
}
