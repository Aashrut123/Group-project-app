import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Redirect, router } from 'expo-router';
import * as Linking from 'expo-linking';

import {
  Button,
  ErrorText,
  Field,
  Page,
} from '@/components/ui';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase';

import { theme } from '@/lib/theme';

export default function AuthScreen() {
  const { user } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setError('');

    if (!isSupabaseConfigured) {
      setError(
        'Connect your Supabase URL and publishable key in .env before signing in.'
      );
      return;
    }

    if (!email.trim() || password.length < 6) {
      setError(
        'Enter a valid email and a password with at least 6 characters.'
      );
      return;
    }

    setBusy(true);

    const result =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                display_name: name.trim(),
              },
            },
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      Alert.alert(
        'Check your email',
        'Confirm your email address, then come back to sign in.'
      );
    } else {
      router.replace('/(tabs)');
    }
  };

  const resetPassword = async () => {
    setError('');

    if (!email.trim()) {
      setError(
        'Enter your email first, then tap reset password.'
      );
      return;
    }

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: Linking.createURL('callback'),
        }
      );

    if (resetError) {
      setError(resetError.message);
    } else {
      Alert.alert(
        'Reset email sent',
        'Check your inbox for a password reset link.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Page style={styles.page}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>G</Text>
            </View>

            <Text style={styles.brandName}>GroupSync</Text>
          </View>

          <Text style={styles.headline}>
            Your group work,
            {'\n'}
            in sync.
          </Text>

          <Text style={styles.copy}>
            Bring deadlines, meetings and teammates together in one
            calm workspace.
          </Text>

          <View style={styles.switcher}>
            <Text
              onPress={() => setMode('login')}
              style={[
                styles.switchText,
                mode === 'login' && styles.switchActive,
              ]}
            >
              Log in
            </Text>

            <Text
              onPress={() => setMode('signup')}
              style={[
                styles.switchText,
                mode === 'signup' && styles.switchActive,
              ]}
            >
              Create account
            </Text>
          </View>

          {mode === 'signup' && (
            <Field
              label="Display name"
              placeholder="How teammates know you"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Field
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Button
            title={
              busy
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Log in'
                  : 'Create account'
            }
            onPress={() => void submit()}
            disabled={busy}
          />

          {mode === 'login' && (
            <Text
              onPress={() => void resetPassword()}
              style={styles.reset}
            >
              Forgot password?
            </Text>
          )}

          <Text style={styles.foot}>
            Secure group spaces powered by Supabase.
          </Text>
        </Page>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  content: {
    flexGrow: 1,
  },

  page: {
    paddingTop: 34,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 30,
  },

  mark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  markText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },

  brandName: {
    color: theme.colors.ink,
    fontSize: 19,
    fontWeight: '800',
  },

  headline: {
    color: theme.colors.ink,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1,
    fontWeight: '800',
  },

  copy: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    marginBottom: 26,
  },

  switcher: {
    flexDirection: 'row',
    gap: 22,
    borderBottomWidth: 1,
    borderColor: theme.colors.line,
    paddingBottom: 10,
    marginBottom: 17,
  },

  switchText: {
    color: theme.colors.faint,
    fontSize: 15,
    fontWeight: '700',
  },

  switchActive: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },

  reset: {
    color: theme.colors.primary,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 15,
  },

  foot: {
    color: theme.colors.faint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 28,
  },
} as const;