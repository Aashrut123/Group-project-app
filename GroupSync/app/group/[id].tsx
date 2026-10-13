import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Card, EmptyState, ErrorText, Loading, Page, Pill, Title } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDate, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import type { CalendarEvent, Group, Membership, Task } from '@/types/database';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [g, m, e, t] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_memberships').select('*, profile:profiles(id,display_name)').eq('group_id', id).order('joined_at'),
      supabase.from('events').select('*').eq('group_id', id).order('starts_at').limit(10),
      supabase.from('tasks').select('*').eq('group_id', id).order('created_at', { ascending: false }).limit(10),
    ]);
    const issue = g.error || m.error || e.error || t.error;
    if (issue) setError(issue.message);
    setGroup(g.data as Group | null); setMembers((m.data || []) as Membership[]); setEvents((e.data || []) as CalendarEvent[]); setTasks((t.data || []) as Task[]); setLoading(false);
  }, [id]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); const channel = supabase.channel(`group-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `group_id=eq.${id}` }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `group_id=eq.${id}` }, () => void load()).subscribe(); return () => { clearTimeout(timer); void supabase.removeChannel(channel); }; }, [id, load]);

  if (loading) return <Loading />;
  const myRole = members.find(member => member.user_id === user?.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';
  const invite = async () => {
    setBusy(true); setError('');
    const { data, error: issue } = await supabase.rpc('create_group_invitation', { target_group_id: id, valid_days: 14 });
    setBusy(false);
    if (issue) setError(issue.message); else setInviteCode(data as string);
  };
  const memberAction = (member: Membership) => {
    const options: { text: string; onPress: () => void }[] = [];
    if (myRole === 'owner' && member.role === 'member') options.push({ text: 'Make admin', onPress: () => void manage(member.user_id, 'admin') });
    if (canManage && member.user_id !== user?.id && member.role !== 'owner') options.push({ text: 'Remove from group', onPress: () => Alert.alert('Remove member?', 'They will lose access to this group.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void manage(member.user_id, 'remove') }]) });
    if (member.user_id === user?.id) options.push({ text: 'Leave group', onPress: () => Alert.alert('Leave this group?', 'You will lose access to its shared work.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => void manage(member.user_id, 'remove') }]) });
    if (!options.length) return;
    Alert.alert(member.profile?.display_name || 'Member', undefined, [...options, { text: 'Cancel', onPress: () => {} }]);
  };
  const manage = async (memberId: string, action: 'admin' | 'remove') => {
    const { error: issue } = await supabase.rpc('manage_group_member', { target_group_id: id, target_user_id: memberId, action });
    if (issue) setError(issue.message); else if (memberId === user?.id) { router.replace('/(tabs)/groups'); } else await load();
  };
  return <Page><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
    {error ? <ErrorText>{error}</ErrorText> : null}
    <View style={styles.groupHero}><View style={[styles.color, { backgroundColor: group?.color || theme.colors.primary }]} /><View style={{ flex: 1 }}><Title subtitle={group?.description || 'Shared group workspace'}>{group?.name || 'Group'}</Title></View></View>
    <View style={styles.section}><Text style={styles.heading}>People <Text style={styles.count}>{members.length}</Text></Text></View>
    {members.map(member => <Card key={member.user_id} style={styles.member}><View style={styles.person}><Text style={styles.initial}>{member.profile?.display_name?.[0]?.toUpperCase() || '?'}</Text><View><Text style={styles.personName}>{member.profile?.display_name || 'Group member'}</Text><Text style={styles.personRole}>{member.role}</Text></View></View><Text onPress={() => memberAction(member)} style={styles.more}>{(canManage && member.user_id !== user?.id) || member.user_id === user?.id ? '•••' : ''}</Text></Card>)}
    {canManage ? <Card style={styles.invite}><Text style={styles.heading}>Invite teammates</Text><Text style={styles.muted}>Create a single-use code that expires in 14 days.</Text><Button title={busy ? 'Creating code…' : 'Create invitation code'} onPress={() => void invite()} secondary disabled={busy} />{inviteCode ? <Text selectable style={styles.code}>{inviteCode}</Text> : null}</Card> : null}
    <View style={styles.section}><Text style={styles.heading}>Upcoming calendar</Text><Text onPress={() => router.push('/create-event')} style={styles.link}>＋ Add</Text></View>
    {events.length ? events.map(event => <Card key={event.id} style={styles.item}><Text onPress={() => router.push(`/event/${event.id}`)} style={styles.itemTitle}>{event.title}</Text><Text onPress={() => router.push(`/event/${event.id}`)} style={styles.muted}>{formatDate(event.starts_at)} · {formatTime(event.starts_at)}{event.location ? ` · ${event.location}` : ''}</Text><View style={{ marginTop: 8 }}><Pill>{event.kind}</Pill></View></Card>) : <EmptyState title="No group dates yet" body="Add a meeting, deadline or event so everyone sees it." />}
    <View style={styles.section}><Text style={styles.heading}>Project tasks</Text><Text onPress={() => router.push('/create-task')} style={styles.link}>＋ Add</Text></View>
    {tasks.length ? tasks.map(task => <Card key={task.id} style={styles.item}><Text onPress={() => router.push(`/task/${task.id}`)} style={styles.itemTitle}>{task.title}</Text><Text onPress={() => router.push(`/task/${task.id}`)} style={styles.muted}>{task.status.replace('_', ' ')} · {formatDate(task.due_at)}</Text></Card>) : <EmptyState title="No tasks yet" body="Capture the work your team needs to finish." />}
    <Button title="Refresh group" onPress={() => void load()} secondary />
  </ScrollView></Page>;
}

const styles = { groupHero: { flexDirection: 'row', gap: 13, alignItems: 'flex-start', marginTop: 4 }, color: { width: 12, height: 46, borderRadius: 8 }, section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }, heading: { color: theme.colors.ink, fontSize: 17, fontWeight: '800' }, count: { color: theme.colors.primary, fontSize: 13 }, member: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }, person: { flexDirection: 'row', alignItems: 'center', gap: 11 }, initial: { width: 38, height: 38, borderRadius: 13, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', backgroundColor: theme.colors.mint, color: theme.colors.primary, fontWeight: '800' }, personName: { color: theme.colors.ink, fontWeight: '700' }, personRole: { color: theme.colors.muted, fontSize: 11, marginTop: 3, textTransform: 'capitalize' }, more: { color: theme.colors.muted, fontWeight: '900', padding: 8 }, invite: { marginTop: 7 }, muted: { color: theme.colors.muted, fontSize: 12, marginTop: 5 }, code: { color: theme.colors.primaryDark, backgroundColor: theme.colors.mint, padding: 12, borderRadius: 10, fontSize: 17, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginTop: 12 }, link: { color: theme.colors.primary, fontWeight: '800' }, item: { paddingVertical: 13 }, itemTitle: { color: theme.colors.ink, fontSize: 14, fontWeight: '800' } } as const;
