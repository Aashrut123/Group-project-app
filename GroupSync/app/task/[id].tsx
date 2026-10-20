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
import { formatDate, personName } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

import type {
  Comment,
  Milestone,
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
  const [blocked, setBlocked] = useState('');
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [milestones, setMilestones] = useState<Pick<Milestone, 'id' | 'title'>[]>([]);

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
    setBlocked(loaded?.blocked_reason || '');
    setRequirements((r.data || []) as Requirement[]);
    setComments((c.data || []) as Comment[]);
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
      const milestoneResult = await supabase.from('milestones').select('id,title').eq('group_id', loaded.group_id).order('sort_order').order('title');
      const fallbackMilestones = milestoneResult.error && /sort_order/.test(milestoneResult.error.message)
        ? await supabase.from('milestones').select('id,title').eq('group_id', loaded.group_id).order('title')
        : milestoneResult;
      setMilestones(fallbackMilestones.error ? [] : (fallbackMilestones.data || []) as Pick<Milestone, 'id' | 'title'>[]);
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
    if (estimatedMinutes != null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes <= 0)) {
      setError('Estimated minutes must be a whole number greater than 0.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: issue } = await supabase.from('tasks').update({
      due_at: due ? due.toISOString() : null,
      estimated_minutes: estimatedMinutes,
      blocked_reason: blocked.trim(),
    }).eq('id', id);
    setBusy(false);
    if (issue) setError(issue.message);
    else await load();
  };

  const setMilestone = async (milestoneId: string | null) => {
    if (!id || busy) return;
    setBusy(true);
    setError('');
    const { error: issue } = await supabase.from('tasks').update({ milestone_id: milestoneId }).eq('id', id);
    setBusy(false);
    if (issue) {
      setError(/milestone_id|schema cache|column/.test(issue.message)
        ? 'Run the latest SQL migration in Supabase, then try again.'
        : issue.message);
      return;
    }
    setTask((current) => (current ? { ...current, milestone_id: milestoneId } : current));
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
              {task.group?.name || 'Personal'} · due{' '}
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

        <Text style={styles.heading}>Milestone</Text>
        <Text style={styles.body}>Optional. This task stays if the milestone is removed.</Text>
        {milestones.length ? (
          <View style={styles.row}>
            <Chip label="None" active={!task.milestone_id} onPress={() => void setMilestone(null)} />
            {milestones.map((milestone) => (
              <Chip
                key={milestone.id}
                label={milestone.title}
                active={task.milestone_id === milestone.id}
                onPress={() => void setMilestone(milestone.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.body}>Add a milestone from the project timeline, then attach this task to it.</Text>
        )}

        <Text style={styles.heading}>Schedule</Text>
        <DateField label="Due" mode="datetime" value={due} onChange={setDue} />
        <Field label="Estimated minutes" value={estimated} onChangeText={setEstimated} keyboardType="number-pad" placeholder="Optional" />
        <Field label="What is blocking this" value={blocked} onChangeText={setBlocked} placeholder="Leave blank if nothing is in the way" />
        <Button title={busy ? 'Saving…' : 'Save schedule'} onPress={() => void saveSchedule()} disabled={busy} secondary />

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