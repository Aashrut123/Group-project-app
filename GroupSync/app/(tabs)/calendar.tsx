import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, EmptyState, ErrorText, Loading, Page, Pill, Title } from '@/components/ui';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatDate, formatTime } from '@/lib/format';
import { theme } from '@/lib/theme';

export default function CalendarScreen() {
  const { groups, events, loading, error } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const filtered = useMemo(() => selected ? events.filter(e => e.group_id === selected) : events, [events, selected]);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = start.getDay();
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const monthCells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => index - offset + 1);
  const weekStart = new Date(selectedDay); weekStart.setDate(selectedDay.getDate() - selectedDay.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => { const day = new Date(weekStart); day.setDate(weekStart.getDate() + index); return day; });
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const hasEvent = (day: Date) => filtered.some(event => sameDay(new Date(event.starts_at), day));
  const visible = useMemo(() => {
    if (view === 'agenda') return filtered;
    return filtered.filter(event => sameDay(new Date(event.starts_at), selectedDay));
  }, [filtered, selectedDay, view]);
  const moveDate = (direction: number) => {
    const next = new Date(anchor);
    if (view === 'week') next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    setAnchor(next); setSelectedDay(next);
  };
  if (loading) return <Loading />;
  return <Page><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
    <View style={styles.header}><Title subtitle="One view across every team">Calendar</Title><Text style={styles.add} onPress={() => router.push('/create-event')}>＋ Add</Text></View>
    <Card style={styles.month}><View style={styles.monthTop}><Text onPress={() => moveDate(-1)} style={styles.nav}>‹</Text><Text style={styles.monthLabel}>{(view === 'week' ? selectedDay : anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Text onPress={() => moveDate(1)} style={styles.nav}>›</Text></View><View style={styles.viewSwitch}>{(['month', 'week', 'agenda'] as const).map(value => <Text key={value} onPress={() => setView(value)} style={[styles.viewOption, view === value && styles.viewActive]}>{value[0].toUpperCase() + value.slice(1)}</Text>)}</View>
      {view === 'month' ? <><View style={styles.grid}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <Text key={`${d}${i}`} style={styles.weekday}>{d}</Text>)}</View><View style={styles.grid}>{monthCells.map((day, i) => { const valid = day > 0 && day <= daysInMonth; const date = new Date(anchor.getFullYear(), anchor.getMonth(), day); return <Text key={i} onPress={() => { if (valid) { setSelectedDay(date); setAnchor(date); } }} style={[styles.day, valid && sameDay(date, selectedDay) && styles.daySelected, !valid && styles.dayBlank]}>{valid ? `${day}${hasEvent(date) ? ' •' : ''}` : ''}</Text>; })}</View></> : view === 'week' ? <View style={styles.grid}>{weekDays.map((day, i) => <Text key={i} onPress={() => { setSelectedDay(day); setAnchor(day); }} style={[styles.weekDay, sameDay(day, selectedDay) && styles.daySelected]}>{day.toLocaleDateString(undefined, { weekday: 'short' })}{'\n'}{day.getDate()}{hasEvent(day) ? ' •' : ''}</Text>)}</View> : <Text style={styles.monthHint}>Upcoming events across all of your groups</Text>}
    </Card>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}><Text onPress={() => setSelected(null)} style={[styles.filter, selected === null && styles.filterActive]}>All groups</Text>{groups.map(g => <Text onPress={() => setSelected(g.id)} key={g.id} style={[styles.filter, selected === g.id && styles.filterActive]}>{g.name}</Text>)}</ScrollView>
    {error ? <ErrorText>{error}</ErrorText> : null}
    <Text style={styles.dayLabel}>{view === 'agenda' ? 'UPCOMING' : selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
    {visible.length ? visible.map(event => <Card key={event.id} style={styles.event}><View style={styles.eventTime}><Text style={styles.time}>{formatTime(event.starts_at)}</Text><Text style={styles.date}>{formatDate(event.starts_at, { weekday: 'short', month: 'short', day: 'numeric' })}</Text></View><View style={[styles.eventLine, { backgroundColor: event.group?.color || theme.colors.primary }]} /><View style={{ flex: 1 }}><Text onPress={() => router.push(`/event/${event.id}`)} style={styles.eventTitle}>{event.title}</Text><Text onPress={() => router.push(`/event/${event.id}`)} style={styles.eventMeta}>{event.group?.name || 'Group'}{event.location ? ` · ${event.location}` : ''}</Text><View style={{ marginTop: 8 }}><Pill>{event.kind}</Pill></View></View></Card>) : <EmptyState title="Your calendar is open" body="Add a group event, meeting or deadline to start building your shared calendar." />}
    <Button title="Add calendar item" onPress={() => router.push('/create-event')} />
  </ScrollView></Page>;
}

const styles = { header: { flexDirection: 'row', justifyContent: 'space-between' }, add: { color: theme.colors.primary, fontWeight: '800', marginTop: 7 }, month: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark }, monthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, nav: { color: 'white', fontSize: 27, fontWeight: '600', paddingHorizontal: 8 }, monthLabel: { color: 'white', fontSize: 20, fontWeight: '800' }, monthHint: { color: '#CDE3DE', fontSize: 13, marginTop: 4 }, viewSwitch: { flexDirection: 'row', gap: 7, marginTop: 12, marginBottom: 8 }, viewOption: { color: '#D5E9E5', fontSize: 11, fontWeight: '800', backgroundColor: '#397B72', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, overflow: 'hidden' }, viewActive: { backgroundColor: 'white', color: theme.colors.primaryDark }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { color: '#BCE1D7', width: '14.285%', textAlign: 'center', paddingVertical: 4, fontWeight: '800', fontSize: 11 }, day: { width: '14.285%', textAlign: 'center', textAlignVertical: 'center', height: 36, color: 'white', fontSize: 12, fontWeight: '700', borderRadius: 18, overflow: 'hidden' }, dayBlank: { color: 'transparent' }, daySelected: { backgroundColor: theme.colors.gold, color: theme.colors.ink }, weekDay: { flex: 1, textAlign: 'center', color: 'white', fontSize: 10, lineHeight: 18, paddingVertical: 7, borderRadius: 12, overflow: 'hidden' }, filters: { gap: 8, paddingVertical: 8, paddingBottom: 17 }, filter: { color: theme.colors.muted, borderRadius: 30, paddingVertical: 8, paddingHorizontal: 13, overflow: 'hidden', backgroundColor: 'white', borderWidth: 1, borderColor: theme.colors.line, fontSize: 12, fontWeight: '700' }, filterActive: { color: 'white', backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }, dayLabel: { color: theme.colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 9 }, event: { flexDirection: 'row', gap: 12, alignItems: 'center' }, eventTime: { width: 67 }, time: { color: theme.colors.ink, fontWeight: '800', fontSize: 13 }, date: { color: theme.colors.muted, fontSize: 10, marginTop: 4 }, eventLine: { width: 3, height: 50, borderRadius: 4 }, eventTitle: { color: theme.colors.ink, fontWeight: '800', fontSize: 15 }, eventMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 4 } } as const;
