import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, EmptyState, ErrorText, Loading, Page, ProgressBar, Section } from '@/components/ui';
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
  const quick = [
    ['Task', 'add-circle-outline', '/create-task'],
    ['Meeting', 'calendar-outline', '/create-event'],
    ['Log', 'create-outline', '/progress'],
    ['Notices', 'notifications-outline', '/notifications'],
  ] as const;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} refreshControl={refreshControl}>
          <View style={styles.greeting}>
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{today}</Text>
              <Text style={styles.greet} numberOfLines={1}>{firstName ? `Hello, ${firstName}` : 'Hello'}</Text>
              <Text style={styles.quiet}>
                {openMine.length} open task{openMine.length === 1 ? '' : 's'}
                {overdue.length ? ` · ${overdue.length} overdue` : ''}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => pressed && styles.pressed}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{profile?.display_name?.[0]?.toUpperCase() || 'G'}</Text></View>
              )}
            </Pressable>
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          <View style={styles.hero}>
            {!activeGroups.length ? (
              <>
                <Text style={styles.kicker}>Start here</Text>
                <Text style={styles.nextTitle}>One project is enough to begin</Text>
                <Text style={styles.heroQuiet}>Invite people later, or keep the work to yourself until the team is ready.</Text>
                <Button title="Create a project" onPress={() => router.push('/create-group')} tone="forest" style={styles.soloButton} />
              </>
            ) : (
              <>
                <Text style={styles.kicker}>Work on this next</Text>
                <Text style={styles.nextTitle} numberOfLines={2}>{nextTask?.title || 'Nothing is waiting on you'}</Text>
                <Text style={styles.heroQuiet}>
                  {nextTask
                    ? `${nextTask.group?.name || 'Personal'} · ${nextTask.due_at ? `Due ${formatDate(nextTask.due_at)}` : 'No due date'}${overdue.length ? ` · ${overdue.length} overdue` : ''}`
                    : 'Add a task when you know the next piece of work.'}
                </Text>
                <View style={styles.heroActions}>
                  {nextTask ? (
                    <Button title="Open task" onPress={() => router.push(`/task/${nextTask.id}`)} tone="forest" style={styles.heroButton} />
                  ) : null}
                  <Button
                    title="Build a plan"
                    onPress={() => router.push({ pathname: '/plan', params: { groupId: activeGroups[0]?.id } })}
                    tone="forest"
                    secondary
                    style={styles.heroButton}
                  />
                </View>
              </>
            )}
          </View>

          <View style={styles.toolbar}>
            {quick.map(([label, icon, href], index) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label === 'Notices' && unread ? `Notices, ${unread} unread` : label}
                onPress={() => router.push(href)}
                style={({ pressed }) => [styles.quickItem, index > 0 && styles.quickRule, pressed && styles.pressed]}
              >
                <View>
                  <Ionicons name={icon} size={20} color={colors.primary} />
                  {label === 'Notices' && unread ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
                  ) : null}
                </View>
                <Text style={styles.quickText}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {conflicts.length ? (
            <Card>
              <Text style={styles.rowTitle}>Schedule conflicts</Text>
              {conflicts.slice(0, 3).map((conflict) => (
                <Text key={`${conflict.a}-${conflict.b}`} style={styles.quiet}>{conflict.a} and {conflict.b}. {conflict.reason}</Text>
              ))}
              <Button title="Review reschedule" onPress={() => router.push({ pathname: '/reschedule', params: { groupId: activeGroups[0]?.id } })} secondary />
            </Card>
          ) : null}

          <Section>Coming up</Section>
          {upcomingEvents.length ? upcomingEvents.map((event, index) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={event.title}
              onPress={() => router.push(`/event/${event.id}`)}
              style={({ pressed }) => [styles.agendaRow, index > 0 && styles.rule, pressed && styles.pressed]}
            >
              <View style={styles.timeCol}>
                <Text style={styles.time}>{formatTime(event.starts_at)}</Text>
                <Text style={styles.timeDate}>{formatDate(event.starts_at, { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={[styles.mark, { backgroundColor: event.group?.color || colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{event.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>{event.group?.name || 'Project'} · {event.kind}</Text>
              </View>
            </Pressable>
          )) : (
            <EmptyState compact title="Nothing scheduled" body="Meetings and deadlines from your projects show up here." />
          )}

          {activeGroups.length ? (
            <>
              <Section>Projects</Section>
              <View style={styles.projectBlock}>
                {activeGroups.slice(0, 3).map((group, index) => {
                  const percent = completionPercent(tasks.filter((task) => task.group_id === group.id));
                  return (
                    <Pressable
                      key={group.id}
                      accessibilityRole="button"
                      accessibilityLabel={group.name}
                      onPress={() => router.push(`/group/${group.id}`)}
                      style={({ pressed }) => [styles.projectRow, index > 0 && styles.rule, pressed && styles.pressed]}
                    >
                      <View style={styles.projectTop}>
                        <View style={[styles.dot, { backgroundColor: group.color || colors.primary }]} />
                        <Text style={styles.rowTitle} numberOfLines={1}>{group.name}</Text>
                        <Text style={styles.percent}>{percent}%</Text>
                      </View>
                      <Text style={styles.meta}>{group.deadline ? `Due ${formatDate(group.deadline)}` : 'No deadline'}</Text>
                      <ProgressBar value={percent} color={group.color || colors.primary} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Section>Team updates</Section>
          {logs.length ? logs.slice(0, 3).map((log, index) => (
            <View key={log.id} style={[styles.update, index > 0 && styles.updateGap]}>
              <Text style={styles.rowTitle}>{log.profile?.display_name || 'Teammate'}</Text>
              <Text style={styles.meta}>{log.group?.name || 'Project'} · {formatDate(log.log_date)}</Text>
              <Text style={styles.body} numberOfLines={2}>{log.accomplishments}</Text>
            </View>
          )) : (
            <EmptyState compact title="No updates yet" body="A short progress log tells the team what actually got finished." />
          )}
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return {
    greeting: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12, marginBottom: 16, marginTop: 4 },
    date: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' as const },
    greet: { color: colors.text, fontSize: 28, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.6, marginTop: 2 },
    quiet: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
    avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center' as const, justifyContent: 'center' as const },
    avatarImage: { width: 40, height: 40, borderRadius: 14 },
    avatarText: { color: colors.onMint, fontWeight: '700' as const, fontSize: 16 },
    kicker: { color: colors.accent, fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
    hero: { backgroundColor: colors.forestFill, borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
    heroQuiet: { color: colors.onForestMuted, fontSize: 13, lineHeight: 18, marginTop: 6 },
    nextTitle: { color: colors.onForest, fontSize: 20, lineHeight: 26, fontWeight: '700' as const, marginTop: 6, letterSpacing: -0.3 },
    heroActions: { flexDirection: 'row' as const, gap: 8, marginTop: 12 },
    heroButton: { flex: 1, marginTop: 0 },
    soloButton: { marginTop: 12 },
    pressed: { opacity: 0.72 },
    toolbar: { flexDirection: 'row' as const, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginTop: 12, marginBottom: 4, overflow: 'hidden' as const },
    quickItem: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 12, minHeight: 68 },
    quickRule: { borderLeftWidth: 1, borderLeftColor: colors.border },
    quickText: { color: colors.text, fontWeight: '600' as const, fontSize: 12 },
    badge: { position: 'absolute' as const, top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const },
    badgeText: { color: colors.primaryForeground, fontSize: 9, fontWeight: '700' as const },
    agendaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 10 },
    rule: { borderTopWidth: 1, borderTopColor: colors.border },
    timeCol: { width: 52 },
    time: { color: colors.text, fontSize: 13, fontWeight: '700' as const },
    timeDate: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    mark: { width: 8, height: 8, borderRadius: 4 },
    rowTitle: { color: colors.text, fontWeight: '700' as const, fontSize: 15 },
    meta: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
    projectBlock: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, marginBottom: 4 },
    projectRow: { paddingVertical: 12 },
    projectTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    percent: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' as const, marginLeft: 'auto' as const },
    update: { paddingBottom: 2 },
    updateGap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    body: { color: colors.textSecondary, marginTop: 4, lineHeight: 20, fontSize: 14 },
  } as const;
}
