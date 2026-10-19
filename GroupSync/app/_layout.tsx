import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { theme } from '@/lib/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />

        <Stack.Screen
          name="auth"
          options={{
            presentation: 'modal',
          }}
        />

        <Stack.Screen
          name="create-group"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'New group',
          }}
        />

        <Stack.Screen
          name="create-event"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'New calendar item',
          }}
        />

        <Stack.Screen
          name="create-task"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'New task',
          }}
        />

        <Stack.Screen
          name="group/[id]"
          options={{
            headerShown: true,
            title: 'Group',
          }}
        />
      </Stack>
    </AuthProvider>
  );
}