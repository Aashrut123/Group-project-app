import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { DateField } from '@/components/DateField';
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Loading,
  Page,
  Pill,
} from '@/components/ui';

import { useAuth } from '@/features/auth/AuthProvider';
import { updateTaskStatus } from '@/hooks/useWorkspace';
import { dependencyCycle, type DependencyLink } from '@/lib/dependencies';
import { formatDate, personName } from '@/lib/format';
import { taskStatusLabel } from '@/lib/planner/status';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

import type {
  Comment,
  Requirement,
  Task,
  TaskStatus,
} from '@/types/database';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [newRequirement, setNewRequirement] = useState('');
  const [due, setDue] = useState<Date | null>(null);
  const [estimated, setEstimated] = useState('');
  const [actual, setActual] = useState('');
  const [blocked, setBlocked] = useState('');
  const [dependencies, setDependencies] = useState<{ id: string; title: string; status: string }[]>([]);
  const [siblings, setSiblings] = useState<{ id: string; title: string; status: string }[]>([]);
  const [links, setLinks] = useState<DependencyLink[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [t, r, c] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          '*, group:groups(id,name,color), assignments:task_assignments(user_id, profile:profiles(display_name))'
        )
        .eq('id', id)
        .single(),

      supabase
        .from('requirements')
        .select('*')
        .eq('task_id', id)
        .order('created_at'),

      supabase
        .from('task_comments')
        .select('*, profile:profiles(display_name)')
        .eq('task_id', id)
        .order('created_at'),
    ]);

    const issue = t.error || r.error || c.error;

    if (issue) setError(issue.message);

    const loaded = t.data as Task | null;
    setTask(loaded);
    setTitle(loaded?.title || '');
    setDescription(loaded?.description || '');
    setDue(loaded?.due_at ? new Date(loaded.due_at) : null);
    setEstimated(loaded?.estimated_minutes ? String(loaded.estimated_minutes) : '');
    setActual(loaded?.actual_minutes != null ? String(loaded.actual_minutes) : '');
    setBlocked(loaded?.blocked_reason || '');
    setRequirements((r.data || []) as Requirement[]);
    setComments((c.data || []) as Comment[]);
    const siblingResult = loaded?.group_id
      ? await supabase.from('tasks').select('id,title,status').eq('group_id', loaded.group_id).order('title')
      : { data: [], error: null };
    const siblingRows = siblingResult.error ? [] : ((siblingResult.data || []) as { id: string; title: string; status: string }[]);
    setSiblings(siblingRows);
    const siblingIds = siblingRows.map((row) => row.id);
    const linkResult = siblingIds.length
      ? await supabase.from('task_dependencies').select('task_id,depends_on').in('task_id', siblingIds)
      : { data: [], error: null };
    const linkRows: DependencyLink[] = linkResult.error
      ? []
      : ((linkResult.data || []) as { task_id: string; depends_on: string }[]).map((row) => ({
          taskId: row.task_id,
          dependsOn: row.depends_on,
        }));
    setLinks(linkRows);
    const byId = new Map(siblingRows.map((row) => [row.id, row]));
    setDependencies(
      linkRows
        .filter((link) => link.taskId === id)
        .map((link) => byId.get(link.dependsOn))
        .filter((row): row is { id: string; title: string; status: string } => Boolean(row)),
    );
    if (siblingResult.error || linkResult.error) {
      setError(siblingResult.error?.message || linkResult.error?.message || 'Could not load dependencies.');
    }
    if (loaded?.group_id) {
      const memberships = await supabase
        .from('group_memberships')
        .select('user_id, profile:profiles(display_name)')
        .eq('group_id', loaded.group_id);
      setMembers(
        (memberships.data || []).map((row) => ({
          user_id: row.user_id,
          name: personName(row.profile),
        })),
      );
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  if (loading) return <Loading />;

  if (!task) {
    return (
      <Page>
        <ErrorText>{error || 'Task not found.'}</ErrorText>
      </Page>
    );
  }

  const canEdit = task.created_by === user?.id;

  const save = async () => {
    setBusy(true);
    setError('');

    const { error: issue } = await supabase
      .from('tasks')
      .update({
        title: title.trim(),
        description: description.trim(),
      })
      .eq('id', id);

    setBusy(false);

    if (issue) {
      setError(issue.message);
    } else {
      await load();
    }
  };

  const saveSchedule = async () => {
    const estimatedMinutes = estimated.trim() ? Number(estimated) : null;
    const actualMinutes = actual.trim() ? Number(actual) : null;
    if (estimatedMinutes != null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes <= 0)) {
      setError('Estimated minutes must be a whole number greater than 0.');
      return;
    }
    if (actualMinutes != null && (!Number.isInteger(actualMinutes) || actualMinutes < 0)) {
      setError('Time spent must be a whole number of minutes.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: issue } = await supabase.from('tasks').update({
      due_at: due ? due.toISOString() : null,
      estimated_minutes: estimatedMinutes,
      actual_minutes: actualMinutes,
      blocked_reason: blocked.trim(),
    }).eq('id', id);
    setBusy(false);
    if (issue) setError(issue.message);
    else await load();
  };

  const toggleDependency = async (parentId: string) => {
    if (!id || parentId === id || busy) return;
    setBusy(true);
    setError('');
    const already = dependencies.some((item) => item.id === parentId);
    if (!already && dependencyCycle(links, id, parentId)) {
      setBusy(false);
      setError('Those tasks would depend on each other in a loop. Pick a task that does not lead back here.');
      return;
    }
    const result = already
      ? await supabase.from('task_dependencies').delete().eq('task_id', id).eq('depends_on', parentId)
      : await supabase.from('task_dependencies').insert({ task_id: id, depends_on: parentId });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  };

  const toggleAssignee = async (userId: string) => {
    const assigned = task.assignments?.some((assignment) => assignment.user_id === userId);
    const result = assigned
      ? await supabase.from('task_assignments').delete().eq('task_id', id).eq('user_id', userId)
      : await supabase.from('task_assignments').insert({ task_id: id, user_id: userId });
    if (result.error) setError(result.error.message);
    else await load();
  };

  const setStatus = async (status: TaskStatus) => {
    setError('');
    try {
      await updateTaskStatus(String(id), status);
      setTask((current) => (current ? { ...current, status } : current));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the task.');
    }
  };

  const addRequirement = async () => {
    if (!newRequirement.trim()) return;

    const { error: issue } = await supabase
      .from('requirements')
      .insert({
        task_id: id,
        title: newRequirement.trim(),
      });

    if (issue) {
      setError(issue.message);
    } else {
      setNewRequirement('');
      await load();
    }
  };

  const toggleRequirement = async (item: Requirement) => {
    const { error: issue } = await supabase
      .from('requirements')
      .update({ completed: !item.completed })
      .eq('id', item.id);

    if (issue) {
      setError(issue.message);
    } else {
      await load();
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;

    const { error: issue } = await supabase
      .from('task_comments')
      .insert({
        task_id: id,
        body: comment.trim(),
      });

    if (issue) {
      setError(issue.message);
    } else {
      setComment('');
      await load();
    }
  };

  const remove = () =>
    Alert.alert(
      'Delete task?',
      'This will also remove its requirements, assignments and comments.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error: issue } = await supabase
              .from('tasks')
              .delete()
              .eq('id', id);

            if (issue) {
              setError(issue.message);
            } else {
              router.back();
            }
          },
        },
      ]
    );

  return (
    <Page>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.group}>
              {task.group?.name || 'Group'} · due{' '}
              {formatDate(task.due_at)}
            </Text>

            <Pill>{task.priority} priority</Pill>
          </View>

          {canEdit ? (
            <Text onPress={remove} style={styles.delete}>
              Delete
            </Text>
          ) : null}
        </View>

        {canEdit ? (
          <>
            <Field
              label="Task title"
              value={title}
              onChangeText={setTitle}
            />

            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Button
              title={busy ? 'Saving…' : 'Save changes'}
              onPress={() => void save()}
              disabled={busy}
              secondary
            />
          </>
        ) : (
          <Card>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.body}>
              {task.description || 'No description provided.'}
            </Text>
          </Card>
        )}

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Text style={styles.heading}>Status</Text>
        <View style={styles.finishAction}>
          <Button
            title={task.status === 'completed' ? 'Mark not finished' : 'Mark finished'}
            onPress={() => void setStatus(task.status === 'completed' ? 'todo' : 'completed')}
          />
        </View>
        <View style={styles.row}>
          {(
            [
              ['todo', 'Not started'],
              ['in_progress', 'In progress'],
              ['blocked', 'Blocked'],
              ['completed', 'Finished'],
            ] as const
          ).map(([value, name]) => (
            <Chip
              key={value}
              label={name}
              active={task.status === value}
              onPress={() => void setStatus(value)}
            />
          ))}
        </View>

        <Text style={styles.heading}>Assigned to</Text>
        {members.length ? (
          <View style={styles.row}>
            {members.map((member) => (
              <Chip
                key={member.user_id}
                label={member.name}
                active={task.assignments?.some((assignment) => assignment.user_id === member.user_id)}
                onPress={() => void toggleAssignee(member.user_id)}
              />
            ))}
          </View>
        ) : (
          <Card>
            <Text style={styles.body}>No teammates are in this project yet.</Text>
          </Card>
        )}

        <Text style={styles.heading}>Schedule</Text>
        <DateField label="Due" mode="datetime" value={due} onChange={setDue} />
        <Field label="Estimated minutes" value={estimated} onChangeText={setEstimated} keyboardType="number-pad" placeholder="Optional" />
        <Field label="Minutes you have spent" value={actual} onChangeText={setActual} keyboardType="number-pad" placeholder="Optional" />
        <Field label="What is blocking this" value={blocked} onChangeText={setBlocked} placeholder="Leave blank if nothing is in the way" />
        <Button title={busy ? 'Saving…' : 'Save schedule'} onPress={() => void saveSchedule()} disabled={busy} secondary />
        <Text style={styles.heading}>Depends on</Text>
        <Text style={styles.body}>This task waits until the ones you select are finished.</Text>
        {dependencies.length ? dependencies.map((item) => (
          <Card key={item.id}>
            <Text style={styles.taskTitle} onPress={() => router.push(`/task/${item.id}`)}>{item.title}</Text>
            <Text style={styles.body}>{taskStatusLabel(item.status)}</Text>
            <Text style={styles.delete} onPress={() => void toggleDependency(item.id)}>Remove</Text>
          </Card>
        )) : (
          <Text style={styles.body}>Nothing is blocking this task yet.</Text>
        )}
        {dependencies.some((item) => item.status !== 'completed') ? (
          <Text style={styles.body}>
            Waiting on {dependencies.filter((item) => item.status !== 'completed').map((item) => item.title).join(', ')}.
          </Text>
        ) : null}
        {siblings.some((item) => item.id !== id && !dependencies.some((chosen) => chosen.id === item.id)) ? (
          <>
            <Text style={styles.heading}>Add a dependency</Text>
            <View style={styles.row}>
              {siblings
                .filter((item) => item.id !== id && !dependencies.some((chosen) => chosen.id === item.id))
                .map((item) => (
                  <Chip key={item.id} label={item.title} onPress={() => void toggleDependency(item.id)} />
                ))}
            </View>
          </>
        ) : (
          <Text style={styles.body}>
            {siblings.length > 1 ? 'Every other task in this project is already linked.' : 'Other tasks in this project will show up here.'}
          </Text>
        )}

        <Text style={styles.heading}>Requirements</Text>

        {requirements.map(item => (
          <Card key={item.id} style={styles.checkRow}>
            <Text
              onPress={() => void toggleRequirement(item)}
              style={[
                styles.requirement,
                item.completed && styles.done,
              ]}
            >
              {item.completed ? '✓  ' : '○  '}
              {item.title}
            </Text>
          </Card>
        ))}

        <Field
          label="Add a requirement"
          value={newRequirement}
          onChangeText={setNewRequirement}
          placeholder="e.g. Add bibliography"
        />

        <Button
          title="Add requirement"
          onPress={() => void addRequirement()}
          secondary
        />

        <Text style={styles.heading}>Comments and updates</Text>

        {comments.map(item => (
          <Card key={item.id}>
            <Text style={styles.commentBy}>
              {item.profile?.display_name || 'Teammate'} ·{' '}
              {formatDate(item.created_at)}
            </Text>

            <Text style={styles.body}>{item.body}</Text>
          </Card>
        ))}

        <Field
          label="Write an update"
          value={comment}
          onChangeText={setComment}
          placeholder="Share progress with the group"
          multiline
        />

        <Button
          title="Post update"
          onPress={() => void addComment()}
        />
      </ScrollView>
    </Page>
  );
}

const styles = {
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  group: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 8,
  },

  delete: {
    color: theme.colors.red,
    fontWeight: '800',
    padding: 8,
  },

  taskTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },

  body: {
    color: theme.colors.muted,
    lineHeight: 20,
    marginTop: 7,
  },

  heading: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 9,
  },

  finishAction: {
    marginBottom: 14,
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  choice: {
    color: theme.colors.muted,
    backgroundColor: 'white',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 10,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
  },

  active: {
    color: 'white',
    backgroundColor: theme.colors.primary,
  },

  checkRow: {
    paddingVertical: 11,
  },

  requirement: {
    color: theme.colors.ink,
    fontWeight: '600',
  },

  done: {
    color: theme.colors.faint,
    textDecorationLine: 'line-through',
  },

  commentBy: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
} as const;