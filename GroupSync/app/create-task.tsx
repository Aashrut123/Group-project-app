import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { router } from 'expo-router';

import { DateField } from '@/components/DateField';
import {
  Button,
  Card,
  ErrorText,
  Field,
  Page,
} from '@/components/ui';

import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

import type {
  Group,
  Membership,
  TaskPriority,
} from '@/types/database';

const priorities: TaskPriority[] = ['low', 'medium', 'high'];

export default function CreateTaskScreen() {
  const { groups, refresh } = useWorkspace();

  const [groupId, setGroupId] = useState('');
  const [members, setMembers] = useState<Membership[]>([]);
  const [assignee, setAssignee] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState<Date | null>(null);
  const [estimate, setEstimate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [requirements, setRequirements] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) return;

    supabase
      .from('group_memberships')
      .select('*, profile:profiles(id,display_name)')
      .eq('group_id', groupId)
      .then(({ data }) =>
        setMembers((data || []) as Membership[])
      );
  }, [groupId]);

  const create = async () => {
    if (!groupId) {
      setError('Choose a group.');
      return;
    }

    if (!title.trim()) {
      setError('Add a task title.');
      return;
    }

    const estimatedMinutes = estimate.trim() ? Number(estimate) : null;
    if (estimatedMinutes != null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes <= 0)) {
      setError('Estimated minutes must be a whole number greater than 0.');
      return;
    }

    setBusy(true);
    setError('');

    const { data: task, error: issue } = await supabase
      .from('tasks')
      .insert({
        group_id: groupId,
        title: title.trim(),
        description: description.trim(),
        due_at: due?.toISOString() || null,
        estimated_minutes: estimatedMinutes,
        priority,
      })
      .select('id')
      .single();

    if (issue || !task) {
      setBusy(false);
      setError(issue?.message || 'Could not create task.');
      return;
    }

    if (assignee) {
      const { error: assignmentIssue } = await supabase
        .from('task_assignments')
        .insert({
          task_id: task.id,
          user_id: assignee,
        });

      if (assignmentIssue) {
        setError(
          `Task saved, but assignment failed: ${assignmentIssue.message}`
        );
      }
    }

    const rows = requirements
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => ({
        task_id: task.id,
        title: line,
      }));

    if (rows.length) {
      const { error: requirementIssue } = await supabase
        .from('requirements')
        .insert(rows);

      if (requirementIssue) {
        setError(
          `Task saved, but requirements failed: ${requirementIssue.message}`
        );
      }
    }

    setBusy(false);
    await refresh();
    router.back();
  };

  return (
    <Page>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <Text style={styles.label}>Group</Text>

        <Card style={styles.choices}>
          {groups.map((group: Group) => (
            <Text
              key={group.id}
              onPress={() => {
                setGroupId(group.id);
                setAssignee('');
              }}
              style={[
                styles.choice,
                groupId === group.id && styles.active,
              ]}
            >
              {group.name}
            </Text>
          ))}
        </Card>

        <Field
          label="Task title"
          placeholder="What needs to get done?"
          value={title}
          onChangeText={setTitle}
        />

        <Field
          label="Description"
          placeholder="Context, links or instructions"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <DateField label="Due" mode="datetime" value={due} onChange={setDue} />

        <Field
          label="Estimated minutes"
          placeholder="Optional, such as 90"
          value={estimate}
          onChangeText={setEstimate}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Priority</Text>

        <Card style={styles.choices}>
          {priorities.map(value => (
            <Text
              key={value}
              onPress={() => setPriority(value)}
              style={[
                styles.choice,
                priority === value && styles.active,
              ]}
            >
              {value}
            </Text>
          ))}
        </Card>

        <Text style={styles.label}>
          Assign to a group member
        </Text>

        <Card style={styles.choices}>
          <Text
            onPress={() => setAssignee('')}
            style={[
              styles.choice,
              !assignee && styles.active,
            ]}
          >
            Unassigned
          </Text>

          {members.map(member => (
            <Text
              key={member.user_id}
              onPress={() => setAssignee(member.user_id)}
              style={[
                styles.choice,
                assignee === member.user_id && styles.active,
              ]}
            >
              {member.profile?.display_name || member.role}
            </Text>
          ))}
        </Card>

        <Field
          label="Requirements / subtasks"
          placeholder="One item per line"
          value={requirements}
          onChangeText={setRequirements}
          multiline
        />

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Button
          title={busy ? 'Saving…' : 'Create task'}
          onPress={() => void create()}
          disabled={busy || !groups.length}
        />
      </ScrollView>
    </Page>
  );
}

const styles = {
  label: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },

  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    padding: 10,
  },

  choice: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  active: {
    color: 'white',
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
} as const;