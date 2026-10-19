import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { theme } from '@/lib/theme';

const glyph: Record<string, string> = {
  index: '⌂',
  calendar: '▦',
  groups: '◎',
  tasks: '✓',
  profile: '◉',
};

export default function TabLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Redirect href="/auth" />;
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

        tabBarIcon: ({ color }) => (
          <Text
            style={{
              color,
              fontSize: 20,
              fontWeight: '800',
            }}
          >
            {glyph[route.name] || '·'}
          </Text>
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
        options={{ title: 'Groups' }}
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
