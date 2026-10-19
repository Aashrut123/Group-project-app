import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import {
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Page,
  Pill,
} from '@/components/ui';

import { useAuth } from '@/features/auth/AuthProvider';
import { formatDate } from '@/lib/format';
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

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [t, r, c] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          '*, group:groups(id,name,color), assignments:task_assignments(user_id)'
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

    setTask(t.data as Task | null);
    setTitle(t.data?.title || '');
    setDescription(t.data?.description || '');
    setRequirements((r.data || []) as Requirement[]);
    setComments((c.data || []) as Comment[]);
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

  const setStatus = async (status: TaskStatus) => {
    const { error: issue } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id);

    if (issue) {
      setError(issue.message);
    } else {
      await load();
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

        <View style={styles.row}>
          {(
            ['todo', 'in_progress', 'blocked', 'completed'] as TaskStatus[]
          ).map(value => (
            <Text
              key={value}
              onPress={() => void setStatus(value)}
              style={[
                styles.choice,
                task.status === value && styles.active,
              ]}
            >
              {value.replace('_', ' ')}
            </Text>
          ))}
        </View>

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

  row: {
    flexDirection: 'row',
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