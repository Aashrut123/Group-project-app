import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { router } from 'expo-router';

import { DateField } from '@/components/DateField';
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Page,
} from '@/components/ui';

import { useWorkspace } from '@/hooks/useWorkspace';
import { personName } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { AppColors } from '@/lib/theme';

import type {
  Group,
  Membership,
  Milestone,
  TaskPriority,
} from '@/types/database';

const priorities: TaskPriority[] = ['low', 'medium', 'high'];

export default function CreateTaskScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { groups, refresh } = useWorkspace();

  const [groupId, setGroupId] = useState('');
  const [members, setMembers] = useState<Membership[]>([]);
  const [milestones, setMilestones] = useState<Pick<Milestone, 'id' | 'title'>[]>([]);
  const [milestoneId, setMilestoneId] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
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

    let active = true;
    supabase
      .from('group_memberships')
      .select('*, profile:profiles(id,display_name)')
      .eq('group_id', groupId)
      .then(({ data }) => {
        if (active) setMembers((data || []) as Membership[]);
      });
    supabase
      .from('milestones')
      .select('id,title')
      .eq('group_id', groupId)
      .order('sort_order')
      .order('title')
      .then(({ data, error: issue }) => {
        if (!active) return;
        if (issue) {
          supabase
            .from('milestones')
            .select('id,title')
            .eq('group_id', groupId)
            .order('title')
            .then((fallback) => {
              if (active) setMilestones((fallback.data || []) as Pick<Milestone, 'id' | 'title'>[]);
            });
          return;
        }
        setMilestones((data || []) as Pick<Milestone, 'id' | 'title'>[]);
      });
    return () => {
      active = false;
    };
  }, [groupId]);

  const chooseGroup = (nextId: string) => {
    const selected = nextId && groupId !== nextId ? nextId : '';
    setGroupId(selected);
    setAssignees([]);
    setMilestoneId('');
    if (!selected) {
      setMembers([]);
      setMilestones([]);
    }
  };

  const create = async () => {
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
        group_id: groupId || null,
        title: title.trim(),
        description: description.trim(),
        due_at: due?.toISOString() || null,
        estimated_minutes: estimatedMinutes,
        priority,
        milestone_id: groupId && milestoneId ? milestoneId : null,
      })
      .select('id')
      .single();

    if (issue || !task) {
      setBusy(false);
      setError(
        issue && /milestone_id|schema cache|column|group_id|not-null|null value|row-level security/i.test(issue.message)
          ? 'Run the latest SQL migration in Supabase, then try again.'
          : issue?.message || 'Could not create task.',
      );
      return;
    }

    if (assignees.length) {
      const { error: assignmentIssue } = await supabase
        .from('task_assignments')
        .insert(assignees.map((userId) => ({ task_id: task.id, user_id: userId })));

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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <Text style={styles.label}>Group</Text>
        <Text style={styles.hint}>Optional. Tap a project to attach this task, then tap it again to leave the task personal.</Text>

        <Card style={styles.choices}>
          <Text
            onPress={() => chooseGroup('')}
            style={[
              styles.choice,
              !groupId && styles.active,
            ]}
          >
            None
          </Text>
          {groups.map((group: Group) => (
            <Text
              key={group.id}
              onPress={() => chooseGroup(group.id)}
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

        {groupId ? (
          <>
            <Text style={styles.label}>Milestone</Text>
            <Text style={styles.hint}>Optional. The task stays if this milestone is removed later.</Text>
            {milestones.length ? (
              <Card style={styles.choices}>
                <Chip label="None" active={!milestoneId} onPress={() => setMilestoneId('')} />
                {milestones.map((milestone) => (
                  <Chip
                    key={milestone.id}
                    label={milestone.title}
                    active={milestoneId === milestone.id}
                    onPress={() => setMilestoneId(milestone.id)}
                  />
                ))}
              </Card>
            ) : (
              <Text style={styles.hint}>This project has no milestones yet. Add one from the project timeline, then attach the task.</Text>
            )}
          </>
        ) : null}

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
          Assign to teammates
        </Text>
        <Text style={styles.hint}>Select everyone sharing this task. Leave them all off to keep it unassigned.</Text>

        <Card style={styles.choices}>
          <Text
            onPress={() => setAssignees([])}
            style={[
              styles.choice,
              assignees.length === 0 && styles.active,
            ]}
          >
            Unassigned
          </Text>

          {members.map(member => (
            <Text
              key={member.user_id}
              onPress={() => setAssignees((current) => current.includes(member.user_id) ? current.filter((id) => id !== member.user_id) : [...current, member.user_id])}
              style={[
                styles.choice,
                assignees.includes(member.user_id) && styles.active,
              ]}
            >
              {personName(member.profile, member.role)}
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
          disabled={busy}
        />
      </ScrollView>
    </Page>
  );
}

function createStyles(colors: AppColors) {
  return {
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },

  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },

  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    padding: 10,
  },

  choice: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  active: {
    color: 'white',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
} as const;
}
