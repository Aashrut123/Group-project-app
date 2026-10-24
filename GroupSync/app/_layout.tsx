import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { AppFrame } from '@/components/AppFrame';
import { Button } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ThemeProvider, useTheme } from '@/features/theme/ThemeProvider';
import { AppearanceProvider } from '@/lib/AppearanceProvider';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Something broke on this screen</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8, marginBottom: 12, lineHeight: 20 }}>{error.message}</Text>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}

function RootNavigator() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          animation: 'fade',
          animationDuration: 220,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="create-group" options={{ presentation: 'modal', headerShown: true, title: 'New project' }} />
        <Stack.Screen name="create-event" options={{ presentation: 'modal', headerShown: true, title: 'New calendar item' }} />
        <Stack.Screen name="create-task" options={{ presentation: 'modal', headerShown: true, title: 'New task' }} />
        <Stack.Screen name="group/[id]" options={{ headerShown: true, title: 'Project' }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: true, title: 'Calendar item' }} />
        <Stack.Screen name="task/[id]" options={{ headerShown: true, title: 'Task' }} />
        <Stack.Screen name="plan" options={{ presentation: 'modal', headerShown: true, title: 'Plan' }} />
        <Stack.Screen name="availability" options={{ headerShown: true, title: 'Availability' }} />
        <Stack.Screen name="progress" options={{ presentation: 'modal', headerShown: true, title: 'Progress log' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notices' }} />
        <Stack.Screen name="reschedule" options={{ presentation: 'modal', headerShown: true, title: 'Reschedule' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppearanceProvider>
        <AuthProvider>
          <AppFrame>
            <RootNavigator />
          </AppFrame>
        </AuthProvider>
      </AppearanceProvider>
    </ThemeProvider>
  );
}
