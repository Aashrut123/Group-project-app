
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
import { useWorkspace } from '@/hooks/useWorkspace';
import { findConflicts } from '@/lib/planner/conflicts';
import { overlapsLocalDay } from '@/lib/planner/dates';
import { formatDate, formatTime } from '@/lib/format';
import { theme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CalendarScreen() {
  const { user } = useAuth();
  const { groups, events, tasks, unavailable, loading, error, refresh } = useWorkspace();

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const filtered = useMemo(
    () =>
      selected
        ? events.filter(event => event.group_id === selected)
        : events,
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

  const hasEvent = (day: Date) =>
    filtered.some(event => overlapsLocalDay(event.starts_at, event.ends_at, day));

  const conflicts = useMemo(() => findConflicts([
    ...filtered.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.starts_at,
      end: event.ends_at,
      kind: event.kind === 'deadline' ? 'deadline' as const : event.kind === 'meeting' ? 'meeting' as const : 'event' as const,
    })),
    ...unavailable.filter((period) => period.user_id === user?.id).map((period) => ({
      id: period.id,
      title: period.reason || 'Unavailable',
      start: new Date(`${period.starts_on}T00:00:00`).toISOString(),
      end: new Date(new Date(`${period.ends_on}T00:00:00`).getTime() + 86_400_000).toISOString(),
      kind: 'unavailable' as const,
    })),
  ]), [filtered, unavailable, user?.id]);

  const deadlines = useMemo(() => {
    const open = tasks.filter((task) => task.status !== 'completed' && task.due_at && (!selected || task.group_id === selected));
    if (view === 'agenda') return open;
    return open.filter((task) => task.due_at && sameDay(new Date(task.due_at), selectedDay));
  }, [tasks, selected, selectedDay, view]);

  const visible = useMemo(() => {
    if (view === 'agenda') {
      return filtered;
    }

    return filtered.filter(event => overlapsLocalDay(event.starts_at, event.ends_at, selectedDay));
  }, [filtered, selectedDay, view]);

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

                    return (
                      <Pressable
                        key={index}
                        accessibilityRole="button"
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
                          {valid ? `${day}${hasEvent(date) ? ' •' : ''}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : view === 'week' ? (
              <View style={styles.grid}>
                {weekDays.map((day, index) => {
                  const chosen = sameDay(day, selectedDay);
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedDay(day);
                        setAnchor(day);
                      }}
                      style={[styles.weekDay, chosen && styles.daySelected]}
                    >
                      <Text style={[styles.dayText, chosen && styles.dayTextSelected]}>
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                        {'\n'}
                        {day.getDate()}
                        {hasEvent(day) ? ' •' : ''}
                      </Text>
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
                {visible.length ? visible.map((event) => (
                  <Text
                    key={event.id}
                    onPress={() => router.push(`/event/${event.id}`)}
                    style={styles.previewItem}
                  >
                    {formatTime(event.starts_at)} · {event.title}
                  </Text>
                )) : (
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
                <Text style={styles.eventMeta}>Task deadline · {task.group?.name || 'Project'} · {formatDate(task.due_at)}</Text>
              </View>
              <Pill>deadline</Pill>
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
                        theme.colors.primary,
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
                    <Pill>{event.kind}</Pill>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              title="Nothing on this day"
              body="Meetings and deadlines that fall on the selected day show up here. Switch to Agenda to see everything coming up."
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

const styles = {
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  add: {
    color: theme.colors.primary,
    fontWeight: '800',
    marginTop: 7,
  },
  month: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryDark,
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
    color: theme.colors.primaryDark,
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
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  dayTextSelected: {
    color: theme.colors.ink,
  },
  dayBlank: {
    opacity: 0,
  },
  daySelected: {
    backgroundColor: theme.colors.gold,
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
    color: theme.colors.muted,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 13,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: theme.colors.line,
    fontSize: 12,
    fontWeight: '700',
  },
  filterActive: {
    color: 'white',
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayLabel: {
    color: theme.colors.faint,
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
    color: theme.colors.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  date: {
    color: theme.colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  eventLine: {
    width: 3,
    height: 50,
    borderRadius: 4,
  },
  eventTitle: {
    color: theme.colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  eventMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
} as const;
