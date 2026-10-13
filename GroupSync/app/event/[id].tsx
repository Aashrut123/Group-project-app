import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, ErrorText, Field, Loading, Page, Pill } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { dateInputValue, formatDate, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { CalendarEvent, EventKind } from '@/types/database';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState<EventKind>('event');
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: issue } = await supabase.from('events').select('*, group:groups(id,name,color)').eq('id', id).single();
    if (issue) { setError(issue.message); setLoading(false); return; }
    const value = data as CalendarEvent;
    setEvent(value); setTitle(value.title); setDescription(value.description); setStartsAt(dateInputValue(new Date(value.starts_at))); setEndsAt(dateInputValue(new Date(value.ends_at))); setLocation(value.location); setKind(value.kind);
    const { data: membership } = await supabase.from('group_memberships').select('role').eq('group_id', value.group_id).eq('user_id', user?.id || '').maybeSingle();
    setCanEdit(value.created_by === user?.id || membership?.role === 'owner' || membership?.role === 'admin');
    setLoading(false);
  }, [id, user?.id]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  if (loading) return <Loading />;
  if (!event) return <Page><ErrorText>{error || 'Calendar item not found.'}</ErrorText></Page>;
  const save = async () => {
    const start = new Date(startsAt), end = new Date(endsAt);
    if (!title.trim() || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) { setError('Add a title, valid dates and a later end time.'); return; }
    setBusy(true); setError('');
    const { error: issue } = await supabase.from('events').update({ title: title.trim(), description: description.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(), location: location.trim(), kind }).eq('id', id);
    setBusy(false); if (issue) setError(issue.message); else await load();
  };
  const remove = () => Alert.alert('Delete calendar item?', 'This removes the item from every group calendar.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { const { error: issue } = await supabase.from('events').delete().eq('id', id); if (issue) setError(issue.message); else router.back(); } }]);
  return <Page><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
    <Text style={{ color: '#657481', marginBottom: 10 }}>{event.group?.name || 'Group'} · {formatDate(event.starts_at)} · {formatTime(event.starts_at)}</Text><Pill>{event.kind}</Pill>
    {canEdit ? <><Field label="Title" value={title} onChangeText={setTitle} /><Field label="Description or agenda" value={description} onChangeText={setDescription} multiline /><Field label="Starts (local time)" value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DDTHH:mm" /><Field label="Ends (local time)" value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DDTHH:mm" /><Field label="Location or video link" value={location} onChangeText={setLocation} /><Text style={{ marginBottom: 12 }}>Type: {(['event', 'meeting', 'deadline'] as EventKind[]).map(value => <Text key={value} onPress={() => setKind(value)} style={{ color: kind === value ? '#2B7168' : '#657481', fontWeight: '700' }}>  {value}  </Text>)}</Text></> : <Field label="Description" value={event.description || 'No description'} editable={false} />}
    {error ? <ErrorText>{error}</ErrorText> : null}
    {canEdit ? <><Button title={busy ? 'Saving…' : 'Save changes'} onPress={() => void save()} disabled={busy} /><Button title="Delete item" onPress={remove} secondary /></> : null}
  </ScrollView></Page>;
}
