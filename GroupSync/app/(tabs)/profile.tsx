
import React, { useState } from 'react';
import { Image, Alert, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Page,
  Title,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const { user, profile, loading, refreshProfile } = useAuth();

  const [name, setName] = useState(profile?.display_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined
  );

  if (loading) return <Loading />;

  const save = async () => {
    if (!user) return;

    try {
      setBusy(true);
      setError('');

      const { error: issue } = await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
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
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <Title subtitle="Your account and preferences">
            Profile & settings
          </Title>

          <Card style={styles.profile}>
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

          {error ? <ErrorText>{error}</ErrorText> : null}

          <Button
            title={busy ? 'Saving…' : 'Save profile'}
            onPress={() => void save()}
            disabled={busy}
          />

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

          <Button
            title={busy ? 'Uploading…' : 'Choose a photo'}
            onPress={() => void pickImageAsync()}
            secondary
            disabled={busy}
          />
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

const styles = {
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
    color: theme.colors.primaryDark,
    backgroundColor: theme.colors.mint,
    fontSize: 28,
    fontWeight: '900' as const,
    overflow: 'hidden' as const,
  },
  email: {
    color: theme.colors.ink,
    fontWeight: '800' as const,
    marginTop: 12,
  },
  member: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  about: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
} as const;
