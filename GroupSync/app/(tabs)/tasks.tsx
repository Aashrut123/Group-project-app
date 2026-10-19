import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
  Title,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { nextTaskStatus } from '@/lib/planner/status';
import { assigneeLabel, formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
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
  todo: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
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

  const cycle = async (
    taskId: string,
    current: TaskStatus
  ) => {
    const next = nextTaskStatus(current);

    const { error: issue } = await supabase
      .from('tasks')
      .update({ status: next })
      .eq('id', taskId);
    if (issue) return;

    await refresh();
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

            <Text
              style={styles.add}
              onPress={() => router.push('/create-task')}
            >
              ＋ Add
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <Text
              onPress={() => setScope('mine')}
              style={[
                styles.filter,
                scope === 'mine' && styles.active,
              ]}
            >
              My tasks
            </Text>

            <Text
              onPress={() => setScope('groups')}
              style={[
                styles.filter,
                scope === 'groups' && styles.active,
              ]}
            >
              All group tasks
            </Text>

            <View style={{ width: 8 }} />

            {(['all', ...statuses] as const).map(value => (
              <Text
                key={value}
                onPress={() => setFilter(value)}
                style={[
                  styles.filter,
                  filter === value && styles.active,
                ]}
              >
                {value === 'all' ? 'All statuses' : label[value]}
              </Text>
            ))}
          </ScrollView>

          <Field label="Search" value={query} onChangeText={setQuery} placeholder="Search titles and descriptions" autoCapitalize="none" />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(['all', 'high', 'medium', 'low'] as const).map((value) => (
              <Chip key={value} label={value === 'all' ? 'Any priority' : value} active={priority === value} onPress={() => setPriority(value)} />
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
                <View style={{ flex: 1 }}>
                  <Text
                    onPress={() =>
                      router.push(`/task/${task.id}`)
                    }
                    style={styles.taskTitle}
                  >
                    {task.title}
                  </Text>

                  <Text
                    onPress={() =>
                      router.push(`/task/${task.id}`)
                    }
                    style={styles.meta}
                  >
                    {task.group?.name || 'Group'} · {assigneeLabel(task.assignments)} · Due{' '}
                    {formatDate(task.due_at)}
                  </Text>

                  <View style={styles.pills}>
                    <Pill
                      color={
                        task.priority === 'high'
                          ? '#FCE9E7'
                          : task.priority === 'medium'
                            ? '#FFF3D9'
                            : undefined
                      }
                    >
                      {task.priority}
                    </Pill>

                    <View style={{ width: 7 }} />

                    <Pill>{label[task.status]}</Pill>
                  </View>
                </View>

                <Text
                  onPress={() =>
                    void cycle(task.id, task.status)
                  }
                  style={styles.check}
                >
                  {task.status === 'completed' ? '✓' : '○'}
                </Text>
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
  add: {
    color: theme.colors.primary,
    fontWeight: '800',
    marginTop: 7,
  },
  filters: {
    gap: 8,
    paddingBottom: 14,
  },
  filter: {
    color: theme.colors.muted,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 13,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  active: {
    color: 'white',
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginTop: 10,
  },
  check: {
    color: theme.colors.primary,
    fontSize: 27,
    padding: 8,
  },
} as const;
