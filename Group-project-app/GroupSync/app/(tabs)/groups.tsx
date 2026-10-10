import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, Title } from '@/components/ui';
import { useWorkspace } from '@/hooks/useWorkspace';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function GroupsScreen() {
  const { groups, loading, error, refresh } = useWorkspace();
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [joinError, setJoinError] = useState('');
  if (loading) return <Loading />;
  const join = async () => {
    if (!code.trim()) return;
    setWorking(true); setJoinError('');
    const { error: joinIssue } = await supabase.rpc('join_group_with_code', { invitation_code: code.trim() });
    setWorking(false);
    if (joinIssue) setJoinError(joinIssue.message);
    else { setCode(''); await refresh(); }
  };
  return <Page><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
    <View style={styles.head}><Title subtitle="Your projects, clubs and teams">Groups</Title><Text style={styles.add} onPress={() => router.push('/create-group')}>＋ New</Text></View>
    {error ? <ErrorText>{error}</ErrorText> : null}
    {groups.length ? groups.map(group => <Card key={group.id} style={styles.group}><View style={[styles.color, { backgroundColor: group.color || theme.colors.primary }]} /><View style={{ flex: 1 }}><Text style={styles.name}>{group.name}</Text><Text style={styles.desc} numberOfLines={2}>{group.description || 'A shared group workspace'}</Text></View><Text onPress={() => router.push(`/group/${group.id}`)} style={styles.open}>›</Text></Card>) : <EmptyState title="No groups yet" body="Create a project team or join with an invitation code." />}
    <Button title="Create a group" onPress={() => router.push('/create-group')} />
    <Card style={styles.join}><Text style={styles.joinTitle}>Have an invite code?</Text><Text style={styles.desc}>Join your teammates&apos; workspace in seconds.</Text><Field label="Invitation code" placeholder="Paste code" value={code} onChangeText={setCode} autoCapitalize="none" />{joinError ? <ErrorText>{joinError}</ErrorText> : null}<Button title={working ? 'Joining…' : 'Join group'} onPress={() => void join()} disabled={working} secondary /></Card>
  </ScrollView></Page>;
}

const styles = { head: { flexDirection: 'row', justifyContent: 'space-between' }, add: { color: theme.colors.primary, fontWeight: '800', marginTop: 7 }, group: { flexDirection: 'row', alignItems: 'center', gap: 12 }, color: { width: 11, height: 46, borderRadius: 8 }, name: { color: theme.colors.ink, fontWeight: '800', fontSize: 16 }, desc: { color: theme.colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }, open: { color: theme.colors.faint, fontSize: 28, paddingHorizontal: 4 }, join: { marginTop: 18 }, joinTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 3 } } as const;
