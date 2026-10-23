import { Ionicons } from '@expo/vector-icons';
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
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { updateTaskStatus, useWorkspace } from '@/hooks/useWorkspace';
import { assigneeLabel, formatDate } from '@/lib/format';
import { taskStatusLabel } from '@/lib/planner/status';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { AppColors } from '@/lib/theme';
import { radius, type } from '@/lib/theme';
import { preferredTimeZone } from '@/lib/timezone';
import type { Task, TaskStatus } from '@/types/database';
import { SafeAreaView } from 'react-native-safe-area-context';

type TaskView = 'today' | 'upcoming' | 'all';

const views: { id: TaskView; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All tasks' },
];

function dayKey(value: string | Date, timeZone: string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : null;
}

function inView(task: Task, view: TaskView, today: string, timeZone: string): boolean {
  if (task.status === 'completed') return false;
  if (view === 'all') return true;
  const due = task.due_at ? dayKey(task.due_at, timeZone) : null;
  if (!due) return false;
  if (view === 'today') return due <= today;
  return due > today;
}

const label: Record<TaskStatus, string> = {
  todo: taskStatusLabel('todo'),
  in_progress: taskStatusLabel('in_progress'),
  blocked: taskStatusLabel('blocked'),
  completed: taskStatusLabel('completed'),
};

export default function TasksScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { profile } = useAuth();
  const { tasks, loading, error, refresh } = useWorkspace();
  const { refreshControl } = usePullRefresh(refresh);
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [view, setView] = useState<TaskView>('today');
  const [searchOpen, setSearchOpen] = useState(false);
  const timeZone = preferredTimeZone(profile?.timezone);
  const today = dayKey(new Date(), timeZone) || '9999-99-99';

  const scoped = tasks.filter((task) => inView(task, view, today, timeZone));
  const visible = scoped
    .filter((task) => {
      const haystack = `${task.title} ${task.description}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) =>
      (a.due_at || '9999').localeCompare(b.due_at || '9999')
    );
  const scopeLabel = view === 'today' ? 'Today' : view === 'upcoming' ? 'Upcoming' : 'All tasks';

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
            <Text style={styles.screenTitle}>My Tasks</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search tasks"
              accessibilityState={{ expanded: searchOpen }}
              onPress={() => {
                setSearchOpen((open) => !open);
                if (searchOpen) setQuery('');
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="options-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <View style={styles.views}>
            {views.map((item) => {
              const selected = view === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setView(item.id)}
                  style={({ pressed }) => [styles.viewChip, selected && styles.viewChipOn, pressed && !selected && styles.viewChipPressed]}
                >
                  <Text style={[styles.viewLabel, selected && styles.viewLabelOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryCount}>{scopeLabel.toUpperCase()} · {visible.length} {visible.length === 1 ? 'TASK' : 'TASKS'}</Text>
          </View>

          {searchOpen ? (
            <Field label="Search" value={query} onChangeText={setQuery} placeholder="Search titles and descriptions" autoCapitalize="none" />
          ) : null}

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
              title={query.trim() ? 'No tasks match this search' : view === 'today' ? 'Nothing due today' : view === 'upcoming' ? 'Nothing coming up' : 'No tasks yet'}
              body={
                query.trim()
                  ? 'Try a different word from a title or description.'
                  : view === 'all'
                    ? 'Add work to a project and it will show up here.'
                    : 'Tasks with a due date in this range show up here. All tasks still lists everything.'
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

function createStyles(colors: AppColors) {
  return {
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  screenTitle: {
    color: colors.ink,
    fontSize: type.title,
    fontWeight: '800',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: {
    opacity: 0.6,
  },
  views: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  viewChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewChipOn: {
    backgroundColor: colors.primary,
  },
  viewChipPressed: {
    backgroundColor: colors.mint,
  },
  viewLabel: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  viewLabelOn: {
    color: colors.onPrimary,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  summaryCount: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
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
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  taskDone: {
    color: colors.muted,
  },
  meta: {
    color: colors.muted,
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
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: {
    backgroundColor: colors.primary,
  },
  markBusy: {
    opacity: 0.45,
  },
  markGlyph: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
} as const;
}

