import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  Button,
  Card,
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
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { updateTaskStatus, useWorkspace } from '@/hooks/useWorkspace';
import { assigneeLabel, formatDate } from '@/lib/format';
import { taskStatusLabel } from '@/lib/planner/status';
import { theme } from '@/lib/theme';
import type { TaskStatus } from '@/types/database';
import { SafeAreaView } from 'react-native-safe-area-context';

const label: Record<TaskStatus, string> = {
  todo: taskStatusLabel('todo'),
  in_progress: taskStatusLabel('in_progress'),
  blocked: taskStatusLabel('blocked'),
  completed: taskStatusLabel('completed'),
};

export default function TasksScreen() {
  const { tasks, loading, error, refresh } = useWorkspace();
  const { refreshControl } = usePullRefresh(refresh);
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const visible = tasks
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
    if (pendingId) return;
    const next = current === 'completed' ? 'todo' : 'completed';
    setPendingId(taskId);
    try {
      await updateTaskStatus(taskId, next);
    } catch {
      await refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={refreshControl}
        >
          <View style={styles.head}>
            <Title subtitle="Across your groups">
              Tasks
            </Title>

            <TextButton title="Add" onPress={() => router.push('/create-task')} />
          </View>

          <Field label="Search" value={query} onChangeText={setQuery} placeholder="Search titles and descriptions" autoCapitalize="none" />

          {error ? <ErrorText>{error}</ErrorText> : null}

          {visible.length ? (
            visible.map(task => (
              <Card
                key={task.id}
                style={styles.task}
              >
                <Pressable accessibilityRole="button" onPress={() => router.push(`/task/${task.id}`)} style={styles.taskBody}>
                  <Text style={[styles.taskTitle, task.status === 'completed' && styles.taskDone]}>{task.title}</Text>
                  <Text style={styles.meta}>
                    {task.group?.name || 'Personal'} · {assigneeLabel(task.assignments)} · Due{' '}
                    {formatDate(task.due_at)}
                  </Text>
                  <View style={styles.pills}>
                    <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                    <Pill tone={statusTone(task.status)}>{label[task.status]}</Pill>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: pendingId === task.id, checked: task.status === 'completed' }}
                  accessibilityLabel={task.status === 'completed' ? 'Mark not finished' : 'Mark finished'}
                  disabled={pendingId === task.id}
                  onPress={() => void toggleFinished(task.id, task.status)}
                  style={({ pressed }) => [styles.check, pressed && styles.checkPressed]}
                >
                  <View style={[styles.mark, task.status === 'completed' && styles.markOn, pendingId === task.id && styles.markBusy]}>
                    <Text style={styles.markGlyph}>{task.status === 'completed' ? '✓' : ''}</Text>
                  </View>
                  <Text style={styles.checkLabel}>{pendingId === task.id ? 'Saving' : task.status === 'completed' ? 'Finished' : 'Finish'}</Text>
                </Pressable>
              </Card>
            ))
          ) : (
            <EmptyState
              title={query.trim() ? 'No tasks match this search' : 'No tasks yet'}
              body={
                query.trim()
                  ? 'Try a different word from a title or description.'
                  : 'Add work to a project and it will show up here.'
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
    fontSize: 16,
    fontWeight: '700',
  },
  taskDone: {
    color: theme.colors.muted,
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
    minWidth: 64,
  },
  checkPressed: {
    opacity: 0.7,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: {
    backgroundColor: theme.colors.primary,
  },
  markBusy: {
    opacity: 0.45,
  },
  markGlyph: {
    color: theme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
} as const;
