
import React, { useEffect, useState } from 'react';
import { Image, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Loading,
  Page,
  Title,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useWorkspace } from '@/hooks/useWorkspace';
import { goalSummary } from '@/lib/goals';
import { deviceTimeZone, preferredTimeZone, timezoneChoices, timezoneLabel } from '@/lib/timezone';
import { phoneAlertsPreference, setPhoneAlerts, syncPhoneAlerts, type AlertPreference } from '@/lib/phoneAlerts';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { AppColors } from '@/lib/theme';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = createStyles(colors);
  const { user, profile, loading, refreshProfile } = useAuth();
  const { tasks, events, refresh } = useWorkspace();
  const { refreshControl } = usePullRefresh(async () => {
    await Promise.all([refreshProfile(), refresh()]);
  });

  const [name, setName] = useState(profile?.display_name || '');
  const [skills, setSkills] = useState(profile?.skills || '');
  const [interests, setInterests] = useState(profile?.interests || '');
  const savedZone = preferredTimeZone(profile?.timezone);
  const [timezoneChoice, setTimezoneChoice] = useState<string | null>(null);
  const timezone = timezoneChoice ?? savedZone;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState<AlertPreference | 'denied'>('unset');
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    void phoneAlertsPreference().then(setAlerts);
  }, []);

  if (loading) return <Loading />;

  const save = async () => {
    if (!user) return;

    try {
      setBusy(true);
      setError('');

      const { error: issue } = await supabase
        .from('profiles')
        .update({
          display_name: name.trim(),
          skills: skills.trim(),
          interests: interests.trim(),
          timezone,
        })
        .eq('id', user.id);

      if (issue) throw issue;

      await refreshProfile();

      Alert.alert(
        'Profile saved',
        'Your teammates will see this display name.'
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save profile.';
      setError(message);
      Alert.alert('Save failed', message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
  };

  const pickImageAsync = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in first.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const image = result.assets[0];

    try {
      setBusy(true);
      setError('');

      // Show the selected image while it uploads.
      setSelectedImage(image.uri);

      const response = await fetch(image.uri);
      const file = await response.arrayBuffer();

      const extension =
        image.mimeType === 'image/png' ? 'png' : 'jpg';

      const filePath = `${user.id}/avatar.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          contentType: image.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // Use the saved URL, not the temporary local image URI.
      setSelectedImage(data.publicUrl);

      await refreshProfile();

      Alert.alert('Success', 'Profile picture saved!');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to upload picture.';

      setError(message);

      // Revert to the previously saved picture if the upload fails.
      setSelectedImage(profile?.avatar_url || undefined);

      Alert.alert('Upload failed', message);
    } finally {
      setBusy(false);
    }
  };

  // Render ONE picture, preferring the newly selected URL and
  // falling back to the URL saved in the Supabase profile.
  const avatarUri = selectedImage || profile?.avatar_url;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} refreshControl={refreshControl}>
          <Title subtitle="Your account and preferences">
            Profile & settings
          </Title>

          <Card style={styles.profile}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a photo"
              disabled={busy}
              onPress={() => void pickImageAsync()}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  onError={() => {
                    console.log('Failed to load profile picture:', avatarUri);
                  }}
                />
              ) : (
                <Text style={styles.avatar}>
                  {name?.[0]?.toUpperCase() || 'G'}
                </Text>
              )}
            </Pressable>

            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.member}>GroupSync member</Text>
          </Card>

          <Field
            label="Display name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />

          <Field
            label="Skills"
            value={skills}
            onChangeText={setSkills}
            placeholder="Wiring, writing, research"
          />

          <Field
            label="Interests"
            value={interests}
            onChangeText={setInterests}
            placeholder="Robotics, student government"
          />

          <Text style={[styles.section, styles.zoneHeading]}>Timezone</Text>
          <Text style={styles.about}>
            Away dates and the calendar use {timezoneLabel(timezone)}. This phone is {timezoneLabel(deviceTimeZone())}.
          </Text>
          <View style={styles.zones}>
            {timezoneChoices(timezone).map((zone) => (
              <Chip key={zone.id} label={zone.label} active={timezone === zone.id} onPress={() => setTimezoneChoice(zone.id)} />
            ))}
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Button
            title={busy ? 'Saving…' : 'Save profile'}
            onPress={() => void save()}
            disabled={busy}
          />

          <Card style={{ marginTop: 8 }}>
            <Text style={styles.section}>Goals</Text>
            <Text style={styles.about}>
              {goalSummary(profile?.goals, profile?.custom_goal) || 'No goals saved yet. They shape milestone suggestions and the built-in planner.'}
            </Text>
            <Button
              title="Edit goals"
              onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })}
              secondary
            />
          </Card>

          <Card>
            <Text style={styles.section}>Appearance</Text>
            <Text style={styles.about}>GroupSync follows your phone until you choose a theme.</Text>
            <View style={styles.zones}>
              {(['system', 'light', 'dark'] as const).map((option) => (
                <Chip key={option} label={option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'} active={preference === option} onPress={() => setPreference(option)} />
              ))}
            </View>
          </Card>

          <Button title="Availability" onPress={() => router.push('/availability')} secondary />
          <Button title="Notices" onPress={() => router.push('/notifications')} secondary />

          <Card style={{ marginTop: 16 }}>
            <Text style={styles.section}>Phone alerts</Text>
            <Text style={styles.about}>
              A task alerts you one hour before it is due. A meeting alerts you 30 minutes before it starts. Expo Go asks you to allow notifications for Expo Go.
            </Text>
            <Button
              title={alerts === 'on' ? 'Turn off phone alerts' : 'Turn on phone alerts'}
              onPress={() => {
                void (async () => {
                  const enabling = alerts !== 'on';
                  const result = await setPhoneAlerts(enabling);
                  if (result === 'denied') {
                    setAlerts('denied');
                    return;
                  }
                  if (result === 'unsupported') {
                    setError('Phone alerts work in the iPhone and Android app.');
                    return;
                  }
                  setAlerts(result);
                  if (result === 'on') syncPhoneAlerts(tasks, events, true);
                })();
              }}
              secondary
            />
            {alerts === 'denied' ? (
              <>
                <Text style={styles.about}>Alerts are blocked. Allow notifications for Expo Go, then turn them on again.</Text>
                <Button title="Open phone settings" onPress={() => void Linking.openSettings()} secondary />
              </>
            ) : null}
            {alerts === 'on' ? <Text style={styles.about}>Phone alerts are on for the tasks and meetings already in GroupSync.</Text> : null}
          </Card>

          <Card style={{ marginTop: 20 }}>
            <Text style={styles.section}>About GroupSync</Text>
            <Text style={styles.about}>
              A shared home for student teams to plan meetings, track project
              tasks, and keep every deadline in view.
            </Text>
          </Card>

          <Button
            title="Log out"
            onPress={() => void logout()}
            secondary
          />
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return {
  profile: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 23,
    textAlign: 'center' as const,
    textAlignVertical: 'center' as const,
    color: colors.primaryDark,
    backgroundColor: colors.mint,
    fontSize: 28,
    fontWeight: '900' as const,
    overflow: 'hidden' as const,
  },
  email: {
    color: colors.ink,
    fontWeight: '800' as const,
    marginTop: 12,
  },
  member: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  about: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  zoneHeading: {
    marginTop: 16,
  },
  zones: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 7,
    marginTop: 10,
  },
} as const;
}

