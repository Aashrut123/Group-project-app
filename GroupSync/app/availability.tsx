import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button, Card, Chip, ErrorText, Field, Loading, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import type { AvailabilityWindow, UnavailablePeriod } from '@/types/database';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function label(minute: number): string {
  const hour = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function AvailabilityScreen() {
  const { user } = useAuth();
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [blocks, setBlocks] = useState<UnavailablePeriod[]>([]);
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('16:00');
  const [end, setEnd] = useState('19:00');
  const [awayStart, setAwayStart] = useState('');
  const [awayEnd, setAwayEnd] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [windowResult, blockResult] = await Promise.all([
      supabase.from('availability_windows').select('*').eq('user_id', user.id).order('weekday'),
      supabase.from('unavailable_periods').select('*').eq('user_id', user.id).order('starts_on'),
    ]);
    if (windowResult.error || blockResult.error) {
      setError(windowResult.error?.message || blockResult.error?.message || 'Could not load availability.');
    }
    setWindows((windowResult.data ?? []) as AvailabilityWindow[]);
    setBlocks((blockResult.data ?? []) as UnavailablePeriod[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const addWindow = async () => {
    const startMinute = minutes(start);
    const endMinute = minutes(end);
    if (startMinute == null || endMinute == null || endMinute <= startMinute) {
      setError('Use HH:mm times, with the end after the start.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: issue } = await supabase.from('availability_windows').insert({
      weekday,
      start_minute: startMinute,
      end_minute: endMinute,
    });
    setBusy(false);
    if (issue) setError(issue.message);
    else await load();
  };

  const addAway = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(awayStart) || !/^\d{4}-\d{2}-\d{2}$/.test(awayEnd) || awayEnd < awayStart) {
      setError('Enter unavailable dates as YYYY-MM-DD, with the end on or after the start.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: issue } = await supabase.from('unavailable_periods').insert({
      starts_on: awayStart,
      ends_on: awayEnd,
      reason: reason.trim(),
    });
    setBusy(false);
    if (issue) setError(issue.message);
    else {
      setReason('');
      await load();
    }
  };

  const removeWindow = async (id: string) => {
    const { error: issue } = await supabase.from('availability_windows').delete().eq('id', id);
    if (issue) setError(issue.message);
    else await load();
  };

  const removeBlock = async (id: string) => {
    const { error: issue } = await supabase.from('unavailable_periods').delete().eq('id', id);
    if (issue) setError(issue.message);
    else await load();
  };

  if (loading) return <Loading />;

  return (
    <Page>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
        <Text style={styles.lead}>The planner uses these hours and away dates. It does not sync them to another calendar.</Text>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Text style={styles.heading}>Weekly windows</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
          {days.map((day, index) => (
            <Chip key={day} label={day} active={weekday === index} onPress={() => setWeekday(index)} />
          ))}
        </ScrollView>
        <Field label="Starts" value={start} onChangeText={setStart} placeholder="16:00" autoCapitalize="none" />
        <Field label="Ends" value={end} onChangeText={setEnd} placeholder="19:00" autoCapitalize="none" />
        <Button title={busy ? 'Saving…' : 'Add window'} onPress={() => void addWindow()} disabled={busy} />
        {windows.map((window) => (
          <Card key={window.id}>
            <Text style={styles.item}>{days[window.weekday]} · {label(window.start_minute)}–{label(window.end_minute)}</Text>
            <Text style={styles.remove} onPress={() => void removeWindow(window.id)}>Remove</Text>
          </Card>
        ))}
        <Text style={styles.heading}>Away dates</Text>
        <Field label="First day away" value={awayStart} onChangeText={setAwayStart} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Field label="Last day away" value={awayEnd} onChangeText={setAwayEnd} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Optional, such as exams or travel" />
        <Button title="Add unavailable period" onPress={() => void addAway()} disabled={busy} secondary />
        {blocks.map((block) => (
          <Card key={block.id}>
            <Text style={styles.item}>{block.starts_on} to {block.ends_on}</Text>
            <Text style={styles.note}>{block.reason || 'Unavailable'}</Text>
            <Text style={styles.remove} onPress={() => void removeBlock(block.id)}>Remove</Text>
          </Card>
        ))}
      </ScrollView>
    </Page>
  );
}

const styles = {
  lead: { color: theme.colors.muted, lineHeight: 20, marginBottom: 12 },
  heading: { color: theme.colors.ink, fontSize: 17, fontWeight: '800' as const, marginTop: 8, marginBottom: 8 },
  days: { gap: 8, paddingBottom: 8 },
  item: { color: theme.colors.ink, fontWeight: '700' as const },
  note: { color: theme.colors.muted, marginTop: 4 },
  remove: { color: theme.colors.red, fontWeight: '700' as const, marginTop: 8 },
};
