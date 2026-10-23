
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Page,
  Pill,
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
          <View style={styles.header}>
            <Title subtitle="One view across every team">
              Calendar
            </Title>

            <Text
              style={styles.add}
              onPress={() => router.push('/create-event')}
            >
              ＋ Add
            </Text>
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          {conflicts.length ? (
            <Card>
              <Text style={styles.dayLabel}>CONFLICTS</Text>
              {conflicts.slice(0, 3).map((conflict) => (
                <Text key={`${conflict.a}-${conflict.b}`} style={styles.eventMeta}>
                  {conflict.a} overlaps {conflict.b}. {conflict.reason}
                </Text>
              ))}
            </Card>
          ) : null}

          <Card style={styles.month}>
            <View style={styles.monthTop}>
              <Text
                onPress={() => moveDate(-1)}
                style={styles.nav}
              >
                ‹
              </Text>

              <Text style={styles.monthLabel}>
                {(view === 'week' ? selectedDay : anchor)
                  .toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}
              </Text>

              <Text
                onPress={() => moveDate(1)}
                style={styles.nav}
              >
                ›
              </Text>
            </View>

            <View style={styles.viewSwitch}>
              {(['month', 'week', 'agenda'] as const).map(
                value => (
                  <Text
                    key={value}
                    onPress={() => setView(value)}
                    style={[
                      styles.viewOption,
                      view === value && styles.viewActive,
                    ]}
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                  </Text>
                )
              )}
            </View>

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
                          chosen && styles.daySelected,
                          !valid && styles.dayBlank,
                        ]}
                      >
                        <Text style={[styles.dayText, chosen && styles.dayTextSelected]}>
                          {valid ? day : ''}
                        </Text>
                        {hasMeeting || hasDeadline ? (
                          <View style={styles.dots}>
                            {hasMeeting ? <View style={[styles.dot, chosen && styles.dotOn]} /> : null}
                            {hasDeadline ? <View style={[styles.dot, styles.dotDeadline]} /> : null}
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : view === 'week' ? (
              <View style={styles.grid}>
                {weekDays.map((day, index) => {
                  const chosen = sameDay(day, selectedDay);
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
                      style={[styles.weekDay, chosen && styles.daySelected]}
                    >
                      <Text style={[styles.dayText, chosen && styles.dayTextSelected]}>
                        {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                      </Text>
                      <Text style={[styles.dayText, chosen && styles.dayTextSelected]}>{day.getDate()}</Text>
                      {hasMeeting || hasDeadline ? (
                        <View style={styles.dots}>
                          {hasMeeting ? <View style={[styles.dot, chosen && styles.dotOn]} /> : null}
                          {hasDeadline ? <View style={[styles.dot, styles.dotDeadline]} /> : null}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.monthHint}>
                Upcoming events across all of your groups
              </Text>
            )}

            {view !== 'agenda' ? (
              <View style={styles.dayPreview}>
                <Text style={styles.monthHint}>
                  {selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                {visible.length || openDue.some((task) => task.due_at && overlapsZonedDay(task.due_at, task.due_at, selectedDay, timeZone)) ? (
                  <>
                    {visible.map((event) => (
                      <Text
                        key={event.id}
                        onPress={() => router.push(`/event/${event.id}`)}
                        style={styles.previewItem}
                      >
                        {event.kind === 'meeting' ? 'Meeting' : event.kind === 'deadline' ? 'Deadline' : 'Event'} · {formatTime(event.starts_at)} · {event.title}
                      </Text>
                    ))}
                    {openDue.filter((task) => task.due_at && overlapsZonedDay(task.due_at, task.due_at, selectedDay, timeZone)).map((task) => (
                      <Text key={task.id} onPress={() => router.push(`/task/${task.id}`)} style={styles.previewItem}>
                        Due · {task.title}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={styles.monthHint}>Nothing scheduled on this day.</Text>
                )}
              </View>
            ) : null}
          </Card>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <Text
              onPress={() => setSelected(null)}
              style={[
                styles.filter,
                selected === null && styles.filterActive,
              ]}
            >
              All groups
            </Text>

            {groups.map(group => (
              <Text
                key={group.id}
                onPress={() => setSelected(group.id)}
                style={[
                  styles.filter,
                  selected === group.id && styles.filterActive,
                ]}
              >
                {group.name}
              </Text>
            ))}
          </ScrollView>

          {deadlines.map((task) => (
            <Card key={`deadline-${task.id}`} style={styles.event}>
              <View style={{ flex: 1 }}>
                <Text onPress={() => router.push(`/task/${task.id}`)} style={styles.eventTitle}>{task.title}</Text>
                <Text style={styles.eventMeta}>Task deadline · {task.group?.name || 'Personal'} · {formatDate(task.due_at)}</Text>
              </View>
              <Pill tone="medium">Deadline</Pill>
            </Card>
          ))}

          <Text style={styles.dayLabel}>
            {view === 'agenda'
              ? 'UPCOMING'
              : selectedDay
                  .toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                  .toUpperCase()}
          </Text>

          {visible.length ? (
            visible.map(event => (
              <Card
                key={event.id}
                style={styles.event}
              >
                <View style={styles.eventTime}>
                  <Text style={styles.time}>
                    {formatTime(event.starts_at)}
                  </Text>

                  <Text style={styles.date}>
                    {formatDate(event.starts_at, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>

                <View
                  style={[
                    styles.eventLine,
                    {
                      backgroundColor:
                        event.group?.color ||
                        colors.primary,
                    },
                  ]}
                />

                <View style={{ flex: 1 }}>
                  <Text
                    onPress={() =>
                      router.push(`/event/${event.id}`)
                    }
                    style={styles.eventTitle}
                  >
                    {event.title}
                  </Text>

                  <Text
                    onPress={() =>
                      router.push(`/event/${event.id}`)
                    }
                    style={styles.eventMeta}
                  >
                    {event.group?.name || 'Group'}
                    {event.location
                      ? ` · ${event.location}`
                      : ''}
                  </Text>

                  <View style={{ marginTop: 8 }}>
                    <Pill tone={event.kind === 'meeting' ? 'active' : event.kind === 'deadline' ? 'medium' : 'neutral'}>
                      {event.kind === 'meeting' ? 'Meeting' : event.kind === 'deadline' ? 'Deadline' : event.kind}
                    </Pill>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              title={view === 'agenda' ? 'Nothing coming up' : 'Nothing on this day'}
              body={view === 'agenda'
                ? 'Meetings and deadlines that are still ahead show up here.'
                : 'This day shows meetings and deadlines that have not ended yet. Agenda lists everything still ahead.'}
            />
          )}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  add: {
    color: colors.primary,
    fontWeight: '800',
    marginTop: 7,
  },
  month: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  monthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nav: {
    color: 'white',
    fontSize: 27,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  monthLabel: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
  monthHint: {
    color: '#CDE3DE',
    fontSize: 13,
    marginTop: 4,
  },
  viewSwitch: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    marginBottom: 8,
  },
  viewOption: {
    color: '#D5E9E5',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#397B72',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  viewActive: {
    backgroundColor: 'white',
    color: colors.primaryDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekday: {
    color: '#BCE1D7',
    width: '14.285%',
    textAlign: 'center',
    paddingVertical: 4,
    fontWeight: '800',
    fontSize: 11,
  },
  day: {
    width: '14.285%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D7EBE7',
  },
  dotOn: {
    backgroundColor: colors.primary,
  },
  dotDeadline: {
    backgroundColor: colors.gold,
  },
  dayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  dayTextSelected: {
    color: colors.ink,
  },
  dayBlank: {
    opacity: 0,
  },
  daySelected: {
    backgroundColor: 'white',
  },
  dayPreview: {
    marginTop: 8,
    gap: 4,
  },
  previewItem: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 2,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 12,
  },
  filters: {
    gap: 8,
    paddingVertical: 8,
    paddingBottom: 17,
  },
  filter: {
    color: colors.muted,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 13,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 12,
    fontWeight: '700',
  },
  filterActive: {
    color: 'white',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayLabel: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 9,
  },
  event: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  eventTime: {
    width: 67,
  },
  time: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  date: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  eventLine: {
    width: 3,
    height: 50,
    borderRadius: 4,
  },
  eventTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
} as const;
}

