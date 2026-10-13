import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, ErrorText, Field, Loading, Page, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

export default function ProfileScreen() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <Loading />;
  const save = async () => {
    if (!user) return;
    setBusy(true); setError('');
    const { error: issue } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', user.id);
    setBusy(false);
    if (issue) setError(issue.message); else { await refreshProfile(); Alert.alert('Profile saved', 'Your teammates will see this display name.'); }
  };
  const logout = async () => { await supabase.auth.signOut(); router.replace('/auth'); };
  return <Page><ScrollView contentContainerStyle={{ paddingBottom: 24 }}><Title subtitle="Your account and preferences">Profile & settings</Title><Card style={styles.profile}><Text style={styles.avatar}>{name?.[0]?.toUpperCase() || 'G'}</Text><Text style={styles.email}>{user?.email}</Text><Text style={styles.member}>GroupSync member</Text></Card><Field label="Display name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />{error ? <ErrorText>{error}</ErrorText> : null}<Button title={busy ? 'Saving…' : 'Save profile'} onPress={() => void save()} disabled={busy} /><Card style={{ marginTop: 20 }}><Text style={styles.section}>About GroupSync</Text><Text style={styles.about}>A shared home for student teams to plan meetings, track project tasks, and keep every deadline in view.</Text></Card><Button title="Log out" onPress={() => void logout()} secondary /></ScrollView></Page>;
}

const styles = { profile: { alignItems: 'center', paddingVertical: 24 }, avatar: { width: 66, height: 66, borderRadius: 23, textAlign: 'center', textAlignVertical: 'center', color: theme.colors.primaryDark, backgroundColor: theme.colors.mint, fontSize: 28, fontWeight: '900', overflow: 'hidden' }, email: { color: theme.colors.ink, fontWeight: '800', marginTop: 12 }, member: { color: theme.colors.muted, fontSize: 12, marginTop: 4 }, section: { color: theme.colors.ink, fontSize: 16, fontWeight: '800' }, about: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 } } as const;
