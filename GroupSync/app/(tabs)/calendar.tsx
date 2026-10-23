
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorText,
  Loading,
  Page,
  Pill,
  Segmented,
  Title,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useWorkspace } from '@/hooks/useWorkspace';
import { findConflicts } from '@/lib/planner/conflicts';
import { isStillScheduled } from '@/lib/planner/dates';
import { overlapsZonedDay, preferredTimeZone, unavailableBounds } from '@/lib/timezone';
import { formatDate, formatTime } from '@/lib/format';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { AppColors } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CalendarScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, profile } = useAuth();
  const timeZone = preferredTimeZone(profile?.timezone);
  const { groups, events, tasks, unavailable, loading, error, refresh } = useWorkspace();
  const { refreshControl } = usePullRefresh(refresh);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const filtered = useMemo(
    () =>
      (selected ? events.filter(event => event.group_id === selected) : events)
        .filter(event => isStillScheduled(event.ends_at)),
    [events, selected]
  );

  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    1
  );

  const offset = start.getDay();

  const daysInMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0
  ).getDate();

  const monthCells = Array.from(
    {
      length: Math.ceil((offset + daysInMonth) / 7) * 7,
    },
    (_, index) => index - offset + 1
  );

  const weekStart = new Date(selectedDay);

  weekStart.setDate(
    selectedDay.getDate() - selectedDay.getDay()
  );

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);

    day.setDate(weekStart.getDate() + index);

    return day;
  });

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const openDue = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.due_at && (!selected || task.group_id === selected)),
    [tasks, selected],
  );

  const conflicts = useMemo(() => findConflicts([
    ...filtered.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.starts_at,
      end: event.ends_at,
      kind: event.kind === 'deadline' ? 'deadline' as const : event.kind === 'meeting' ? 'meeting' as const : 'event' as const,
    })),
    ...unavailable.filter((period) => period.user_id === user?.id).map((period) => {
      const bounds = unavailableBounds(period.starts_on, period.ends_on, timeZone);
      return {
        id: period.id,
        title: period.reason || 'Unavailable',
        start: bounds.start,
        end: bounds.end,
        kind: 'unavailable' as const,
      };
    }),
  ]), [filtered, unavailable, user?.id, timeZone]);

  const deadlines = useMemo(() => {
    const open = tasks.filter((task) => task.status !== 'completed' && task.due_at && (!selected || task.group_id === selected));
    if (view === 'agenda') return open;
    return open.filter((task) => task.due_at && overlapsZonedDay(task.due_at, task.due_at, selectedDay, timeZone));
  }, [tasks, selected, selectedDay, view, timeZone]);

  const visible = useMemo(() => {
    if (view === 'agenda') {
      return filtered;
    }

    return filtered.filter(event => overlapsZonedDay(event.starts_at, event.ends_at, selectedDay, timeZone));
  }, [filtered, selectedDay, view, timeZone]);

  const moveDate = (direction: number) => {
    const next = new Date(anchor);

    if (view === 'week') {
      next.setDate(next.getDate() + direction * 7);
    } else {
      next.setMonth(next.getMonth() + direction);
    }

    setAnchor(next);
    setSelectedDay(next);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={refreshControl}
        >
          <Title subtitle="One view across every team">Calendar</Title>

          {error ? <ErrorText>{error}</ErrorText> : null}

          {conflicts.length ? (
            <Card>
              <Text style={styles.conflictTitle}>Conflicts</Text>
              {conflicts.slice(0, 3).map((conflict) => (
                <Text key={`${conflict.a}-${conflict.b}`} style={styles.eventMeta}>
                  {conflict.a} overlaps {conflict.b}. {conflict.reason}
                </Text>
              ))}
            </Card>
          ) : null}

          <Card style={styles.month}>
            <View style={styles.monthTop}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous" onPress={() => moveDate(-1)} hitSlop={8} style={styles.navHit}>
                <Text style={styles.nav}>‹</Text>
              </Pressable>

              <Text style={styles.monthLabel}>
                {(view === 'week' ? selectedDay : anchor)
                  .toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}
              </Text>

              <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={() => moveDate(1)} hitSlop={8} style={styles.navHit}>
                <Text style={styles.nav}>›</Text>
              </Pressable>
            </View>

            <Segmented
              onDark
              options={[{ id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }, { id: 'agenda', label: 'Agenda' }]}
              value={view}
              onChange={(id) => setView(id as 'month' | 'week' | 'agenda')}
            />

            {view === 'month' ? (
              <>
                <View style={styles.grid}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(
                    (day, index) => (
                      <Text
                        key={`${day}${index}`}
                        style={styles.weekday}
                      >
                        {day}
                      </Text>
                    )
                  )}
                </View>

                <View style={styles.grid}>
                  {monthCells.map((day, index) => {
                    const valid =
                      day > 0 && day <= daysInMonth;

                    const date = new Date(
                      anchor.getFullYear(),
                      anchor.getMonth(),
                      day
                    );
                    const chosen = valid && sameDay(date, selectedDay);
                    const isToday = valid && sameDay(date, new Date());
                    const hasMeeting = valid && filtered.some((event) => overlapsZonedDay(event.starts_at, event.ends_at, date, timeZone));
                    const hasDeadline = valid && openDue.some((task) => task.due_at && overlapsZonedDay(task.due_at, task.due_at, date, timeZone));

                    return (
                      <Pressable
                        key={index}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen }}
                        accessibilityLabel={valid ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : undefined}
                        disabled={!valid}
                        onPress={() => {
                          setSelectedDay(date);
                          setAnchor(date);
                        }}
                        style={[
                          styles.day,
                          isToday && !chosen && styles.dayToday,
                          chosen && styles.daySelected,
                          !valid && styles.dayBlank,
                        ]}
                      >
                        <Text style={[styles.dayText, chosen && styles.dayTextSelected]}>
                          {valid ? day : ''}
                        </Text>
                        <View style={styles.dots}>
                          {hasMeeting ? <View style={[styles.dot, chosen && styles.dotOn]} /> : null}
                          {hasDeadline ? <View style={[styles.dot, styles.dotDeadline]} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : view === 'week' ? (
              <View style={styles.weekRow}>
                {weekDays.map((day, index) => {
                  const chosen = sameDay(day, selectedDay);
                  const isToday = sameDay(day, new Date());
                  const hasMeeting = filtered.some((event) => overlapsZonedDay(event.starts_at, event.ends_at, day, timeZone));
                  const hasDeadline = openDue.some((task) => task.due_at && overlapsZonedDay(task.due_at, task.due_at, day, timeZone));
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityState={{ selected: chosen }}
                      onPress={() => {
                        setSelectedDay(day);
                        setAnchor(day);
                      }}
                      style={[styles.weekDay, isToday && !chosen && styles.dayToday, chosen && styles.daySelected]}
                    >
                      <Text style={[styles.dayText, chosen && styles.dayTextSelected]}>
                        {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                      </Text>
                      <Text style={[styles.dayText, chosen && styles.dayTextSelected]}>{day.getDate()}</Text>
                      <View style={styles.dots}>
                        {hasMeeting ? <View style={[styles.dot, chosen && styles.dotOn]} /> : null}
                        {hasDeadline ? <View style={[styles.dot, styles.dotDeadline]} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.monthHint}>Everything still ahead, across your projects.</Text>
            )}
          </Card>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <Chip label="All groups" active={selected === null} onPress={() => setSelected(null)} />
            {groups.map(group => (
              <Chip key={group.id} label={group.name} active={selected === group.id} onPress={() => setSelected(group.id)} />
            ))}
          </ScrollView>

          <Text style={styles.dayLabel}>
            {view === 'agenda'
              ? 'Upcoming'
              : selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>

          {deadlines.map((task) => (
            <Pressable key={`deadline-${task.id}`} accessibilityRole="button" accessibilityLabel={task.title} onPress={() => router.push(`/task/${task.id}`)} style={({ pressed }) => [styles.event, pressed && styles.pressed]}>
              <View style={styles.eventTime}>
                <Text style={styles.time}>Due</Text>
                <Text style={styles.date}>{formatDate(task.due_at, { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={[styles.eventDot, { backgroundColor: colors.gold }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={2}>{task.title}</Text>
                <Text style={styles.eventMeta}>{task.group?.name || 'Personal'}</Text>
              </View>
              <Pill tone="medium">Deadline</Pill>
            </Pressable>
          ))}

          {visible.map(event => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={event.title}
              onPress={() => router.push(`/event/${event.id}`)}
              style={({ pressed }) => [styles.event, pressed && styles.pressed]}
            >
              <View style={styles.eventTime}>
                <Text style={styles.time}>{formatTime(event.starts_at)}</Text>
                <Text style={styles.date}>{formatDate(event.starts_at, { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={[styles.eventDot, { backgroundColor: event.group?.color || colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{event.group?.name || 'Project'}{event.location ? ` · ${event.location}` : ''}</Text>
              </View>
              <Pill tone={event.kind === 'meeting' ? 'active' : event.kind === 'deadline' ? 'medium' : 'neutral'}>
                {event.kind === 'meeting' ? 'Meeting' : event.kind === 'deadline' ? 'Deadline' : 'Event'}
              </Pill>
            </Pressable>
          ))}

          {!visible.length && !deadlines.length ? (
            <EmptyState
              compact
              title={view === 'agenda' ? 'Nothing coming up' : 'Nothing on this day'}
              body={view === 'agenda'
                ? 'Meetings and deadlines that are still ahead show up here.'
                : 'Pick another day, or switch to Agenda for everything still ahead.'}
            />
          ) : null}

          <Button
            title="Add calendar item"
            onPress={() => router.push('/create-event')}
          />
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return {
    month: { backgroundColor: colors.forestFill, borderColor: colors.forestFill, paddingBottom: 12 },
    monthTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 12 },
    navHit: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const },
    nav: { color: colors.onForest, fontSize: 26, fontWeight: '500' as const, lineHeight: 28 },
    monthLabel: { color: colors.onForest, fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
    monthHint: { color: colors.onForestMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    weekday: { color: colors.onForestMuted, width: '14.285%' as const, textAlign: 'center' as const, paddingVertical: 4, fontWeight: '700' as const, fontSize: 11 },
    day: { width: '14.285%' as const, height: 42, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 12 },
    dots: { flexDirection: 'row' as const, gap: 3, height: 6, marginTop: 2 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.onForest },
    dotOn: { backgroundColor: colors.onAccent },
    dotDeadline: { backgroundColor: colors.gold },
    dayText: { color: colors.onForest, fontSize: 13, fontWeight: '600' as const, textAlign: 'center' as const },
    dayTextSelected: { color: colors.onAccent },
    dayBlank: { opacity: 0 },
    dayToday: { borderWidth: 1, borderColor: colors.accent },
    daySelected: { backgroundColor: colors.accent },
    weekRow: { flexDirection: 'row' as const },
    weekDay: { flex: 1, alignItems: 'center' as const, paddingVertical: 8, borderRadius: 12 },
    filters: { gap: 8, paddingVertical: 12 },
    conflictTitle: { color: colors.text, fontSize: 15, fontWeight: '700' as const, marginBottom: 4 },
    dayLabel: { color: colors.text, fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2, marginBottom: 6 },
    event: { flexDirection: 'row' as const, gap: 10, alignItems: 'center' as const, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
    pressed: { opacity: 0.7 },
    eventTime: { width: 52 },
    time: { color: colors.text, fontWeight: '700' as const, fontSize: 13 },
    date: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    eventDot: { width: 8, height: 8, borderRadius: 4 },
    eventTitle: { color: colors.text, fontWeight: '700' as const, fontSize: 15, lineHeight: 20 },
    eventMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  } as const;
}

