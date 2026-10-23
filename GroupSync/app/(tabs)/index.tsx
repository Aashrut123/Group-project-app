import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, ErrorText, Loading, Page, Pill, ProgressBar, Section } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useWorkspace } from '@/hooks/useWorkspace';
import { findConflicts } from '@/lib/planner/conflicts';
import { isStillScheduled } from '@/lib/planner/dates';
import { preferredTimeZone, unavailableBounds } from '@/lib/timezone';
import { completionPercent, isOpenStatus } from '@/lib/planner/status';
import { formatDate, formatTime } from '@/lib/format';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { AppColors } from '@/lib/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { profile, user } = useAuth();
  const timeZone = preferredTimeZone(profile?.timezone);
  const { groups, events, tasks, logs, notifications, unavailable, loading, error, refresh } = useWorkspace();
  const { refreshControl } = usePullRefresh(refresh);

  const activeGroups = groups.filter((group) => group.status !== 'archived');
  const mine = tasks.filter((task) => task.assignments?.some((assignment) => assignment.user_id === user?.id) || task.created_by === user?.id);
  const openMine = mine.filter((task) => isOpenStatus(task.status));
  const nextTask = [...openMine].sort((a, b) => (a.due_at || '9999').localeCompare(b.due_at || '9999'))[0];
  const overdue = openMine.filter((task) => task.due_at && task.due_at < new Date().toISOString());
  const upcomingEvents = events.filter((event) => isStillScheduled(event.ends_at)).slice(0, 3);
  const unread = notifications.filter((item) => !item.read_at).length;

  const conflicts = useMemo(() => findConflicts([
    ...events.filter((event) => isStillScheduled(event.ends_at)).map((event) => ({
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
  ]), [events, unavailable, user?.id, timeZone]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Loading />
      </SafeAreaView>
    );
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }} refreshControl={refreshControl}>
          <View style={styles.greeting}>
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{today}</Text>
              <Text style={styles.greet}>{firstName ? `Hello, ${firstName}` : 'Hello'}</Text>
              <Text style={styles.quiet}>
                {openMine.length} open task{openMine.length === 1 ? '' : 's'}
                {overdue.length ? ` · ${overdue.length} overdue` : ''}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/(tabs)/profile')}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{profile?.display_name?.[0]?.toUpperCase() || 'G'}</Text></View>
              )}
            </Pressable>
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          {!activeGroups.length ? (
            <View style={styles.hero}>
              <Text style={styles.kicker}>Start here</Text>
              <Text style={styles.nextTitle}>One project is enough to begin</Text>
              <Text style={styles.heroQuiet}>Invite people later, or keep the work to yourself until the team is ready.</Text>
              <Button title="Create a project" onPress={() => router.push('/create-group')} light />
            </View>
          ) : (
            <View style={styles.hero}>
              <Text style={styles.kicker}>Work on this next</Text>
              <Text style={styles.nextTitle}>{nextTask?.title || 'Nothing is waiting on you'}</Text>
              <Text style={styles.heroQuiet}>
                {nextTask
                  ? `${nextTask.group?.name || 'Personal'} · ${nextTask.due_at ? `due ${formatDate(nextTask.due_at)}` : 'no due date'}${overdue.length ? ` · ${overdue.length} overdue` : ''}`
                  : 'Add a task when you know the next piece of work.'}
              </Text>
              <View style={styles.actions}>
                {nextTask ? <Button title="Open task" onPress={() => router.push(`/task/${nextTask.id}`)} light /> : null}
                <Button title="Build a plan" onPress={() => router.push({ pathname: '/plan', params: { groupId: activeGroups[0]?.id } })} secondary />
              </View>
            </View>
          )}

          <View style={styles.quick}>
            {([
              ['Task', 'add-circle-outline', '/create-task'],
              ['Meeting', 'calendar-outline', '/create-event'],
              ['Log', 'create-outline', '/progress'],
              ['Notices', 'notifications-outline', '/notifications'],
            ] as const).map(([label, icon, href]) => (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href)} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}>
                <Ionicons name={icon} size={18} color={colors.primary} />
                <Text style={styles.quickText}>{label}{label === 'Notices' && unread ? ` ${unread}` : ''}</Text>
              </Pressable>
            ))}
          </View>

          {conflicts.length ? (
            <Card>
              <Text style={styles.cardTitle}>Schedule conflicts</Text>
              {conflicts.slice(0, 3).map((conflict) => (
                <Text key={`${conflict.a}-${conflict.b}`} style={styles.quiet}>{conflict.a} and {conflict.b}. {conflict.reason}</Text>
              ))}
              <Button title="Review reschedule" onPress={() => router.push({ pathname: '/reschedule', params: { groupId: activeGroups[0]?.id } })} secondary />
            </Card>
          ) : null}

          <Section>Coming up</Section>
          {upcomingEvents.length ? upcomingEvents.map((event) => (
            <Pressable key={event.id} accessibilityRole="button" onPress={() => router.push(`/event/${event.id}`)}>
              <Card style={styles.rowCard}>
                <View style={[styles.bar, { backgroundColor: event.group?.color || colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  <Text style={styles.quiet}>{event.group?.name} · {formatDate(event.starts_at)} at {formatTime(event.starts_at)}</Text>
                </View>
                <Pill>{event.kind}</Pill>
              </Card>
            </Pressable>
          )) : <EmptyState title="No upcoming events" body="Meetings and deadlines from your projects show up here." />}

          <Section>Projects</Section>
          {activeGroups.slice(0, 3).map((group) => {
            const groupTasks = tasks.filter((task) => task.group_id === group.id);
            const percent = completionPercent(groupTasks);
            return (
              <Pressable key={group.id} accessibilityRole="button" onPress={() => router.push(`/group/${group.id}`)}>
                <Card>
                  <Text style={styles.cardTitle}>{group.name}</Text>
                  <ProgressBar
                    value={percent}
                    color={group.color || colors.primary}
                    label={`${percent}% of tasks complete${group.deadline ? ` · due ${formatDate(group.deadline)}` : ''}`}
                  />
                </Card>
              </Pressable>
            );
          })}

          <Section>Team updates</Section>
          {logs.length ? logs.slice(0, 3).map((log) => (
            <Card key={log.id}>
              <Text style={styles.cardTitle}>{log.profile?.display_name || 'Teammate'}</Text>
              <Text style={styles.quiet}>{log.group?.name} · {formatDate(log.log_date)}</Text>
              <Text style={styles.body}>{log.accomplishments}</Text>
            </Card>
          )) : <EmptyState title="No progress logs yet" body="A short update tells the team what actually got finished." />}
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return {
  greeting: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 12, marginBottom: 16 },
  date: { color: colors.primary, fontSize: 12, fontWeight: '800' as const, letterSpacing: 0.4 },
  greet: { color: colors.ink, fontSize: 28, fontWeight: '800' as const, marginTop: 4 },
  quiet: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center' as const, justifyContent: 'center' as const },
  avatarImage: { width: 44, height: 44, borderRadius: 14 },
  avatarText: { color: colors.primaryDark, fontWeight: '800' as const, fontSize: 18 },
  kicker: { color: '#B8E5C8', fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  hero: { backgroundColor: '#163D32', borderRadius: 22, padding: 18, marginBottom: 14 },
  heroQuiet: { color: '#D7EBE3', fontSize: 14, lineHeight: 20, marginTop: 8 },
  nextTitle: { color: '#F4FBF7', fontSize: 24, lineHeight: 30, fontWeight: '700' as const, marginTop: 8, letterSpacing: -0.4 },
  pressed: { opacity: 0.72 },
  actions: { gap: 4, marginTop: 4 },
  quick: { flexDirection: 'row' as const, gap: 8, marginBottom: 4 },
  quickItem: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, alignItems: 'center' as const, gap: 6 },
  quickText: { color: colors.primaryDark, fontWeight: '800' as const, fontSize: 12 },
  cardTitle: { color: colors.ink, fontWeight: '800' as const, fontSize: 15 },
  rowCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  bar: { width: 4, height: 36, borderRadius: 4 },
  body: { color: colors.ink, marginTop: 8, lineHeight: 20 },
} as const;
}

