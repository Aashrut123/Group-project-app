import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, ErrorText, Loading, Page, Pill, ProgressBar, Section } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { findConflicts } from '@/lib/planner/conflicts';
import { isStillScheduled } from '@/lib/planner/dates';
import { homeLead } from '@/lib/goals';
import { completionPercent, isOpenStatus } from '@/lib/planner/status';
import { formatDate, formatTime } from '@/lib/format';
import { theme } from '@/lib/theme';

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const { groups, events, tasks, logs, notifications, unavailable, loading, error, refresh } = useWorkspace();

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
    ...unavailable.filter((period) => period.user_id === user?.id).map((period) => ({
      id: period.id,
      title: period.reason || 'Unavailable',
      start: new Date(`${period.starts_on}T00:00:00`).toISOString(),
      end: new Date(new Date(`${period.ends_on}T00:00:00`).getTime() + 86_400_000).toISOString(),
      kind: 'unavailable' as const,
    })),
  ]), [events, unavailable, user?.id]);

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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
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
            <Card>
              <Text style={styles.cardTitle}>Start with one project</Text>
              <Text style={styles.quiet}>
                {homeLead(profile?.goals, profile?.planning_style)
                  ? `${homeLead(profile?.goals, profile?.planning_style)} Create a project when you are ready. Teammates can join later.`
                  : 'Create a project, then invite people with a single-use code when you want them. You can work alone until then.'}
              </Text>
              <Button title="Create a project" onPress={() => router.push('/create-group')} />
            </Card>
          ) : (
            <Card style={styles.next}>
              <Text style={styles.kicker}>WORK ON THIS NEXT</Text>
              <Text style={styles.nextTitle}>{nextTask?.title || 'Nothing is waiting on you'}</Text>
              <Text style={styles.nextMeta}>
                {nextTask
                  ? `${nextTask.group?.name || 'Project'} · ${nextTask.due_at ? `due ${formatDate(nextTask.due_at)}` : 'no due date'}`
                  : 'Open tasks when you want to add the next piece of work.'}
              </Text>
              <View style={styles.actions}>
                {nextTask ? <Button title="Open task" light onPress={() => router.push(`/task/${nextTask.id}`)} /> : null}
                <Button title="Build a plan" onPress={() => router.push({ pathname: '/plan', params: { groupId: activeGroups[0]?.id } })} secondary />
              </View>
            </Card>
          )}

          <View style={styles.quick}>
            {[
              ['Task', '/create-task'],
              ['Meeting', '/create-event'],
              ['Log', '/progress'],
              ['Notices', '/notifications'],
            ].map(([label, href]) => (
              <Pressable key={label} accessibilityRole="button" onPress={() => router.push(href as '/create-task')} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}>
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
                <View style={[styles.bar, { backgroundColor: event.group?.color || theme.colors.primary }]} />
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
                    color={group.color || theme.colors.primary}
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

          <Button title="Refresh" onPress={() => void refresh()} secondary />
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

const styles = {
  greeting: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 12, marginBottom: 16 },
  date: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' as const, letterSpacing: 0.4 },
  greet: { color: theme.colors.ink, fontSize: 28, fontWeight: '800' as const, marginTop: 4 },
  quiet: { color: theme.colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.mint, alignItems: 'center' as const, justifyContent: 'center' as const },
  avatarImage: { width: 44, height: 44, borderRadius: 14 },
  avatarText: { color: theme.colors.primaryDark, fontWeight: '800' as const, fontSize: 18 },
  next: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  kicker: { color: theme.colors.onPrimaryMuted, fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.8 },
  nextTitle: { color: theme.colors.onPrimary, fontSize: 22, fontWeight: '800' as const, marginTop: 8 },
  nextMeta: { color: theme.colors.onPrimaryMuted, marginTop: 6, lineHeight: 18 },
  pressed: { opacity: 0.72 },
  actions: { gap: 4 },
  quick: { flexDirection: 'row' as const, gap: 8, marginBottom: 12 },
  quickItem: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, paddingVertical: 12, alignItems: 'center' as const },
  quickText: { color: theme.colors.primaryDark, fontWeight: '800' as const, fontSize: 12 },
  cardTitle: { color: theme.colors.ink, fontWeight: '800' as const, fontSize: 15 },
  rowCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  bar: { width: 4, height: 36, borderRadius: 4 },
  body: { color: theme.colors.ink, marginTop: 8, lineHeight: 20 },
};
