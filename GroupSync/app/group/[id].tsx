
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { DateField } from '@/components/DateField';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Page,
  Pill,
  Title,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDate, formatTime } from '@/lib/format';
import { formatDay, parseDay } from '@/lib/planner/dates';
import { useWorkspace, updateTaskStatus } from '@/hooks/useWorkspace';
import { completionPercent, taskStatusLabel } from '@/lib/planner/status';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import type {
  CalendarEvent,
  Group,
  Membership,
  Milestone,
  ProgressLog,
  Task,
  TaskPriority,
} from '@/types/database';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { tasks: sharedTasks } = useWorkspace();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'overview' | 'tasks' | 'timeline' | 'team' | 'updates'>('overview');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [outcome, setOutcome] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const load = useCallback(async () => {
    const [g, m, e, t] = await Promise.all([
      supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single(),

      supabase
        .from('group_memberships')
        .select(
          '*, profile:profiles(id, display_name, avatar_url)'
        )
        .eq('group_id', id)
        .order('joined_at'),

      supabase
        .from('events')
        .select('*')
        .eq('group_id', id)
        .gt('ends_at', new Date().toISOString())
        .order('starts_at')
        .limit(10),

      supabase
        .from('tasks')
        .select('*')
        .eq('group_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const issue = g.error || m.error || e.error || t.error;

    if (issue) {
      setError(issue.message);
    }

    const loadedGroup = g.data as Group | null;
    setGroup(loadedGroup);
    setOutcome(loadedGroup?.outcome || '');
    setDeadline(loadedGroup?.deadline ? parseDay(loadedGroup.deadline) : null);
    setPriority(loadedGroup?.priority || 'medium');
    setMembers((m.data || []) as Membership[]);
    setEvents((e.data || []) as CalendarEvent[]);
    setTasks((t.data || []) as Task[]);
    const [milestoneResult, logResult] = await Promise.all([
      supabase.from('milestones').select('*').eq('group_id', id).order('due_on'),
      supabase.from('progress_logs').select('*, profile:profiles(display_name)').eq('group_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    setMilestones(milestoneResult.error ? [] : (milestoneResult.data || []) as Milestone[]);
    setLogs(logResult.error ? [] : (logResult.data || []) as ProgressLog[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    const channel = supabase
      .channel(`group-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `group_id=eq.${id}`,
        },
        () => void load()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `group_id=eq.${id}`,
        },
        () => void load()
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  if (loading) {
    return <Loading />;
  }

  const projectTasks = tasks.map((task) => {
    const live = sharedTasks.find((item) => item.id === task.id);
    return live ? { ...task, status: live.status } : task;
  });

  const myRole = members.find(
    member => member.user_id === user?.id
  )?.role;

  const canManage =
    myRole === 'owner' || myRole === 'admin';

  const saveProject = async () => {
    setBusy(true);
    setError('');
    const { error: issue } = await supabase.from('groups').update({
      outcome: outcome.trim(),
      deadline: deadline ? formatDay(deadline) : null,
      priority,
    }).eq('id', id);
    setBusy(false);
    if (issue) setError(issue.message);
    else await load();
  };

  const invite = async () => {
    setBusy(true);
    setError('');

    const { data, error: issue } = await supabase.rpc(
      'create_group_invitation',
      {
        target_group_id: id,
        valid_days: 14,
      }
    );

    setBusy(false);

    if (issue) {
      setError(issue.message);
    } else {
      setInviteCode(data as string);
    }
  };

  const memberAction = (member: Membership) => {
    const options: {
      text: string;
      onPress: () => void;
    }[] = [];

    if (
      myRole === 'owner' &&
      member.role === 'member'
    ) {
      options.push({
        text: 'Make admin',
        onPress: () =>
          void manage(member.user_id, 'admin'),
      });
    }

    if (
      canManage &&
      member.user_id !== user?.id &&
      member.role !== 'owner'
    ) {
      options.push({
        text: 'Remove from group',
        onPress: () =>
          Alert.alert(
            'Remove member?',
            'They will lose access to this group.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () =>
                  void manage(member.user_id, 'remove'),
              },
            ]
          ),
      });
    }

    if (member.user_id === user?.id) {
      options.push({
        text: 'Leave group',
        onPress: () =>
          Alert.alert(
            'Leave this group?',
            'You will lose access to its shared work.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: () =>
                  void manage(member.user_id, 'remove'),
              },
            ]
          ),
      });
    }

    if (!options.length) {
      return;
    }

    Alert.alert(
      member.profile?.display_name || 'Member',
      undefined,
      [
        ...options,
        {
          text: 'Cancel',
          onPress: () => {},
        },
      ]
    );
  };

  const manage = async (
    memberId: string,
    action: 'admin' | 'remove'
  ) => {
    const { error: issue } = await supabase.rpc(
      'manage_group_member',
      {
        target_group_id: id,
        target_user_id: memberId,
        action,
      }
    );

    if (issue) {
      setError(issue.message);
    } else if (memberId === user?.id) {
      router.replace('/(tabs)/groups');
    } else {
      await load();
    }
  };

  return (
    <Page>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        {error ? <ErrorText>{error}</ErrorText> : null}

        <View style={styles.groupHero}>
          <View
            style={[
              styles.color,
              {
                backgroundColor:
                  group?.color || theme.colors.primary,
              },
            ]}
          />

          <View style={{ flex: 1 }}>
            <Title
              subtitle={
                group?.description ||
                'Shared group workspace'
              }
            >
              {group?.name || 'Group'}
            </Title>
          </View>
        </View>

        <Text style={styles.muted}>
          {completionPercent(projectTasks, milestones.map((item) => ({ completed: Boolean(item.completed_at) })))}% complete
          {group?.deadline ? ` · deadline ${formatDate(group.deadline)}` : ''}
          {group?.outcome ? ` · ${group.outcome}` : ''}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sections}>
          {([
            ['overview', 'Overview'],
            ['tasks', 'Tasks'],
            ['timeline', 'Timeline'],
            ['team', 'Team'],
            ['updates', 'Updates'],
          ] as const).map(([value, label]) => (
            <Chip key={value} label={label} active={section === value} onPress={() => setSection(value)} />
          ))}
        </ScrollView>

        {(section === 'overview' || section === 'team') ? (
        <>
        <View style={styles.section}>
          <Text style={styles.heading}>
            People{' '}
            <Text style={styles.count}>
              {members.length}
            </Text>
          </Text>
        </View>

        {members.map(member => (
          <Card
            key={member.user_id}
            style={styles.member}
          >
            <View style={styles.person}>
              {member.profile?.avatar_url ? (
                <Image
                  source={{ uri: member.profile.avatar_url }}
                  style={styles.initial}
                  onError={() => {
                    console.log("Failed to load avatar:", member.profile?.avatar_url);
                  }}
                />
              ) : (
                <View style={styles.memberAvatarFallback}>
                  <Text style={styles.memberAvatarText}>
                    {member.profile?.display_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}

              <View>
                <Text style={styles.personName}>
                  {member.profile?.display_name || 'UnNamed Group member'}
                </Text>

                <Text style={styles.personRole}>
                  {member.role}
                </Text>
              </View>
            </View>

            <Text
              onPress={() => memberAction(member)}
              style={styles.more}
            >
              {(canManage && member.user_id !== user?.id) ||
              member.user_id === user?.id
                ? '•••'
                : ''}
            </Text>
          </Card>
        ))}

        {canManage ? (
          <Card style={styles.invite}>
            <Text style={styles.heading}>
              Invite teammates
            </Text>

            <Text style={styles.muted}>
              Create a single-use code that expires in
              14 days.
            </Text>

            <Button
              title={
                busy
                  ? 'Creating code…'
                  : 'Create invitation code'
              }
              onPress={() => void invite()}
              secondary
              disabled={busy}
            />

            {inviteCode ? (
              <Text
                selectable
                style={styles.code}
              >
                {inviteCode}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {section === 'overview' && canManage ? (
          <Card>
            <Text style={styles.heading}>Project settings</Text>
            <Field label="Intended outcome" value={outcome} onChangeText={setOutcome} multiline placeholder="What does done look like?" />
            <DateField label="Deadline" value={deadline} onChange={setDeadline} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {(['low', 'medium', 'high'] as const).map((value) => (
                <Chip key={value} label={value} active={priority === value} onPress={() => setPriority(value)} />
              ))}
            </View>
            <Button title={busy ? 'Saving…' : 'Save project'} onPress={() => void saveProject()} disabled={busy} secondary />
          </Card>
        ) : null}

        {section === 'overview' ? (
          <Card>
            <Text style={styles.heading}>Plan and adjust</Text>
            <Button title="Build a plan" onPress={() => router.push({ pathname: '/plan', params: { groupId: id } })} />
            <Button title="Propose a reschedule" onPress={() => router.push({ pathname: '/reschedule', params: { groupId: id } })} secondary />
            <Button title="Post a progress log" onPress={() => router.push({ pathname: '/progress', params: { groupId: id } })} secondary />
            {myRole === 'owner' ? (
              <Button
                title={group?.status === 'archived' ? 'Archived' : 'Archive project'}
                disabled={busy || group?.status === 'archived'}
                secondary
                onPress={() => {
                  Alert.alert('Archive this project?', 'Members keep their history, and the project leaves the active list.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Archive', style: 'destructive', onPress: () => void (async () => {
                      const { error: issue } = await supabase.from('groups').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', id);
                      if (issue) setError(issue.message);
                      else await load();
                    })() },
                  ]);
                }}
              />
            ) : null}
          </Card>
        ) : null}
        </>
        ) : null}

        {(section === 'overview' || section === 'timeline') ? (
        <>
        <View style={styles.section}>
          <Text style={styles.heading}>
            Upcoming calendar
          </Text>

          <Text
            onPress={() => router.push('/create-event')}
            style={styles.link}
          >
            ＋ Add
          </Text>
        </View>

        {events.length ? (
          events.map(event => (
            <Card
              key={event.id}
              style={styles.item}
            >
              <Text
                onPress={() =>
                  router.push(`/event/${event.id}`)
                }
                style={styles.itemTitle}
              >
                {event.title}
              </Text>

              <Text
                onPress={() =>
                  router.push(`/event/${event.id}`)
                }
                style={styles.muted}
              >
                {formatDate(event.starts_at)} ·{' '}
                {formatTime(event.starts_at)}
                {event.location
                  ? ` · ${event.location}`
                  : ''}
              </Text>

              <View style={{ marginTop: 8 }}>
                <Pill>{event.kind}</Pill>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            title="Nothing coming up"
            body="Meetings that have already ended stay on the calendar day you tap."
          />
        )}

        </>
        ) : null}

        {section === 'timeline' ? (
          <>
            <Text style={styles.heading}>Milestones</Text>
            {milestones.length ? milestones.map((milestone) => (
              <Card key={milestone.id}>
                <Text style={styles.itemTitle}>{milestone.title}</Text>
                <Text style={styles.muted}>{milestone.due_on ? formatDate(milestone.due_on) : 'No date'}{milestone.completed_at ? ' · done' : ''}</Text>
              </Card>
            )) : <EmptyState title="No milestones yet" body="A reviewed plan can add milestones, or you can keep using tasks and calendar items." />}
          </>
        ) : null}

        {(section === 'overview' || section === 'tasks') ? (
        <>
        <View style={styles.section}>
          <Text style={styles.heading}>
            Project tasks
          </Text>

          <Text
            onPress={() => router.push('/create-task')}
            style={styles.link}
          >
            ＋ Add
          </Text>
        </View>

        {projectTasks.length ? (
          projectTasks.map(task => (
            <Card
              key={task.id}
              style={styles.item}
            >
              <Text
                onPress={() =>
                  router.push(`/task/${task.id}`)
                }
                style={styles.itemTitle}
              >
                {task.title}
              </Text>

              <Text
                onPress={() =>
                  router.push(`/task/${task.id}`)
                }
                style={styles.muted}
              >
                {taskStatusLabel(task.status)} ·{' '}
                {formatDate(task.due_at)}
              </Text>
              <Text
                onPress={() => {
                  void updateTaskStatus(task.id, task.status === 'completed' ? 'todo' : 'completed').catch((cause: unknown) => {
                    setError(cause instanceof Error ? cause.message : 'Could not update the task.');
                  });
                }}
                style={styles.link}
              >
                {task.status === 'completed' ? 'Mark not finished' : 'Mark finished'}
              </Text>
            </Card>
          ))
        ) : (
          <EmptyState
            title="No tasks yet"
            body="Capture the work your team needs to finish."
          />
        )}

        </>
        ) : null}

        {section === 'updates' ? (
          <>
            <Button title="Post a progress log" onPress={() => router.push({ pathname: '/progress', params: { groupId: id } })} />
            {logs.length ? logs.map((log) => (
              <Card key={log.id}>
                <Text style={styles.itemTitle}>{log.profile?.display_name || 'Teammate'}</Text>
                <Text style={styles.muted}>{formatDate(log.log_date)}</Text>
                <Text style={styles.muted}>{log.accomplishments}</Text>
                {log.next_steps ? <Text style={styles.muted}>Next: {log.next_steps}</Text> : null}
                {log.blockers ? <Text style={styles.muted}>Blocked: {log.blockers}</Text> : null}
              </Card>
            )) : <EmptyState title="No updates yet" body="Progress logs only show work someone on the team actually posted." />}
          </>
        ) : null}

        <Button
          title="Refresh project"
          onPress={() => void load()}
          secondary
        />
      </ScrollView>
    </Page>
  );
}

const styles = {
  groupHero: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  color: {
    width: 12,
    height: 46,
    borderRadius: 8,
  },
  sections: {
    gap: 8,
    paddingBottom: 12,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  heading: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  count: {
    color: theme.colors.primary,
    fontSize: 13,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  initial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.mint
  },
  memberAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.mint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  memberAvatarText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '800'
  },
  personName: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  personRole: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  more: {
    color: theme.colors.muted,
    fontWeight: '900',
    padding: 8,
  },
  invite: {
    marginTop: 7,
  },
  muted: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  code: {
    color: theme.colors.primaryDark,
    backgroundColor: theme.colors.mint,
    padding: 12,
    borderRadius: 10,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 12,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  item: {
    paddingVertical: 13,
  },
  itemTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
} as const;
