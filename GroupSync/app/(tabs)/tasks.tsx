import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

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
  priorityTone,
  statusTone,
  TextButton,
  Title,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { updateTaskStatus, useWorkspace } from '@/hooks/useWorkspace';
import { assigneeLabel, formatDate } from '@/lib/format';
import { taskStatusLabel } from '@/lib/planner/status';
import { theme } from '@/lib/theme';
import type { TaskPriority, TaskStatus } from '@/types/database';
import { SafeAreaView } from 'react-native-safe-area-context';

const statuses: TaskStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'completed',
];

const label: Record<TaskStatus, string> = {
  todo: taskStatusLabel('todo'),
  in_progress: taskStatusLabel('in_progress'),
  blocked: taskStatusLabel('blocked'),
  completed: taskStatusLabel('completed'),
};

export default function TasksScreen() {
  const { user } = useAuth();
  const { groups, tasks, loading, error, refresh } = useWorkspace();

  const [filter, setFilter] = useState<'all' | TaskStatus>(
    'all'
  );
  const [priority, setPriority] = useState<'all' | TaskPriority>('all');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scope, setScope] = useState<'mine' | 'groups'>(
    'mine'
  );
  const [query, setQuery] = useState('');

  const mine = useMemo(
    () =>
      tasks.filter(
        task =>
          task.assignments?.some(
            assignment => assignment.user_id === user?.id
          ) || task.created_by === user?.id
      ),
    [tasks, user?.id]
  );

  const visible = (
    scope === 'mine' ? mine : tasks
  )
    .filter(
      task => filter === 'all' || task.status === filter
    )
    .filter((task) => priority === 'all' || task.priority === priority)
    .filter((task) => !projectId || task.group_id === projectId)
    .filter((task) => {
      const haystack = `${task.title} ${task.description}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) =>
      (a.due_at || '9999').localeCompare(b.due_at || '9999')
    );

  if (loading) {
    return <Loading />;
  }

  const toggleFinished = async (taskId: string, current: TaskStatus) => {
    const next = current === 'completed' ? 'todo' : 'completed';
    try {
      await updateTaskStatus(taskId, next);
    } catch {
      await refresh();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={styles.head}>
            <Title subtitle="Across your groups">
              Tasks
            </Title>

            <TextButton title="Add" onPress={() => router.push('/create-task')} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <Chip label="My tasks" active={scope === 'mine'} onPress={() => setScope('mine')} />
            <Chip label="All group tasks" active={scope === 'groups'} onPress={() => setScope('groups')} />
            {(['all', ...statuses] as const).map(value => (
              <Chip
                key={value}
                label={value === 'all' ? 'All statuses' : label[value]}
                active={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </ScrollView>

          <Field label="Search" value={query} onChangeText={setQuery} placeholder="Search titles and descriptions" autoCapitalize="none" />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(['all', 'high', 'medium', 'low'] as const).map((value) => (
              <Chip key={value} label={value === 'all' ? 'Any priority' : value[0].toUpperCase() + value.slice(1)} active={priority === value} onPress={() => setPriority(value)} />
            ))}
            <Chip label="All projects" active={!projectId} onPress={() => setProjectId(null)} />
            {groups.map((group) => (
              <Chip key={group.id} label={group.name} active={projectId === group.id} onPress={() => setProjectId(group.id)} />
            ))}
          </ScrollView>

          {error ? <ErrorText>{error}</ErrorText> : null}

          {visible.length ? (
            visible.map(task => (
              <Card
                key={task.id}
                style={styles.task}
              >
                <Pressable accessibilityRole="button" onPress={() => router.push(`/task/${task.id}`)} style={styles.taskBody}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.meta}>
                    {task.group?.name || 'Group'} · {assigneeLabel(task.assignments)} · Due{' '}
                    {formatDate(task.due_at)}
                  </Text>
                  <View style={styles.pills}>
                    <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                    <Pill tone={statusTone(task.status)}>{label[task.status]}</Pill>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={task.status === 'completed' ? 'Mark not finished' : 'Mark finished'}
                  onPress={() => void toggleFinished(task.id, task.status)}
                  style={styles.check}
                >
                  <Text style={styles.checkMark}>{task.status === 'completed' ? '✓' : '○'}</Text>
                  <Text style={styles.checkLabel}>{task.status === 'completed' ? 'Finished' : 'Finish'}</Text>
                </Pressable>
              </Card>
            ))
          ) : (
            <EmptyState
              title={
                scope === 'mine'
                  ? 'No tasks assigned to you yet'
                  : 'No tasks match this view'
              }
              body={
                scope === 'mine'
                  ? 'Ask a teammate to assign you a task, or switch to all group tasks to browse the shared work.'
                  : 'Add work to a group, assign it to yourself or a teammate, and track progress here.'
              }
            />
          )}

          <Button
            title="Create a task"
            onPress={() => router.push('/create-task')}
          />
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

const styles = {
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filters: {
    gap: 8,
    paddingBottom: 14,
  },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  taskBody: {
    flex: 1,
  },
  taskTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  check: {
    alignItems: 'center',
    padding: 8,
  },
  checkMark: {
    color: theme.colors.primary,
    fontSize: 27,
    fontWeight: '700',
  },
  checkLabel: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
} as const;
