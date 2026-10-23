import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { DateField } from '@/components/DateField';
import { AiBanner, Button, Card, Chip, ErrorText, Field, Page, Pill, Section } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { saveReviewedPlan } from '@/features/plans/savePlan';
import { useWorkspace } from '@/hooks/useWorkspace';
import { generatePlan } from '@/lib/planner/generate';
import type { GeneratedPlan, PlannerMember } from '@/lib/planner/types';
import { formatDay, parseDay, todayDay } from '@/lib/planner/dates';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { AppColors } from '@/lib/theme';
import { type } from '@/lib/theme';
import type { Membership, UnavailablePeriod } from '@/types/database';

export default function PlanScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const params = useLocalSearchParams<{ groupId?: string }>();
  const { profile } = useAuth();
  const { groups, tasks, refresh } = useWorkspace();
  const [groupId, setGroupId] = useState(params.groupId ?? '');
  const [outcome, setOutcome] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(parseDay(todayDay()));
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [hours, setHours] = useState('6');
  const [constraints, setConstraints] = useState('');
  const [milestones, setMilestones] = useState('');
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [included, setIncluded] = useState<boolean[]>([]);
  const [includeMeetings, setIncludeMeetings] = useState(false);
  const [busy, setBusy] = useState<'build' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const selectedGroup = groups.find((group) => group.id === groupId);

  const build = async () => {
    if (busy) return;
    if (!groupId) {
      setError('Choose a project first.');
      return;
    }
    setBusy('build');
    setError('');
    setSavedNote('');
    try {
      const memberships = await supabase
        .from('group_memberships')
        .select('*, profile:profiles(id,display_name,skills)')
        .eq('group_id', groupId);
      if (memberships.error) throw new Error(memberships.error.message);
      const members = (memberships.data ?? []) as Membership[];
      const ids = members.map((member) => member.user_id);
      const windowsResult = ids.length
        ? await supabase.from('availability_windows').select('*').in('user_id', ids)
        : { data: [], error: null };
      const unavailableResult = ids.length
        ? await supabase.from('unavailable_periods').select('*').in('user_id', ids)
        : { data: [], error: null };
      const weekly = Number(hours);
      const plannerMembers: PlannerMember[] = members.map((member) => {
        const windows = ((windowsResult.error ? [] : windowsResult.data) ?? []).filter((row) => row.user_id === member.user_id);
        const weeklyFromWindows = windows.reduce(
          (sum: number, row: { start_minute: number; end_minute: number }) => sum + (row.end_minute - row.start_minute) / 60,
          0,
        );
        return {
          id: member.user_id,
          name: member.profile?.display_name || 'Teammate',
          skills: member.profile?.skills || '',
          weeklyHours: weeklyFromWindows > 0 ? Math.min(40, Math.max(1, Math.round(weeklyFromWindows))) : weekly,
          availableWeekdays: [...new Set(windows.map((row: { weekday: number }) => row.weekday))],
          unavailable: ((unavailableResult.error ? [] : unavailableResult.data ?? []) as UnavailablePeriod[])
            .filter((row) => row.user_id === member.user_id)
            .map((row) => ({ start: row.starts_on, end: row.ends_on })),
        };
      });
      const groupTasks = tasks.filter((task) => task.group_id === groupId);
      const session = await supabase.auth.getSession();
      const next = await generatePlan(
        {
          title: selectedGroup?.name || 'Project',
          outcome: outcome.trim() || selectedGroup?.outcome || selectedGroup?.description || '',
          startDate: formatDay(startDate ?? parseDay(selectedGroup?.starts_on || todayDay()) ?? new Date()),
          deadline: deadline ? formatDay(deadline) : selectedGroup?.deadline || '',
          priority: selectedGroup?.priority || 'medium',
          weeklyHoursDefault: weekly,
          constraints,
          milestones: milestones.split('\n').map((line) => {
            const [title, date] = line.split('|').map((part) => part.trim());
            return { title: title ?? '', date };
          }).filter((item) => item.title),
          members: plannerMembers,
          existingTasks: groupTasks.map((task) => ({
            title: task.title,
            status: task.status,
            assigneeId: task.assignments?.[0]?.user_id ?? null,
            estimatedMinutes: task.estimated_minutes ?? undefined,
          })),
          focus: profile?.goals?.[0],
          pace: profile?.planning_style,
        },
        {
          useAi: process.env.EXPO_PUBLIC_AI_ENABLED === 'true',
          supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
          accessToken: session.data.session?.access_token,
          apiKey: isSupabaseConfigured ? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined,
        },
      );
      setPlan(next);
      setIncluded(next.tasks.map((task) => !task.alreadyTracked));
      setIncludeMeetings(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build a plan.');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!plan || !groupId || busy) return;
    setBusy('save');
    setError('');
    const chosen = plan.tasks.filter((_, index) => included[index]);
    const result = await saveReviewedPlan({
      groupId,
      plan,
      tasks: chosen,
      meetings: includeMeetings ? plan.meetings : [],
        input: {
          outcome,
          startDate: startDate ? formatDay(startDate) : '',
          deadline: deadline ? formatDay(deadline) : '',
          hours,
          constraints,
          milestones,
        },
    });
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refresh();
    setSavedNote(
      `Saved ${result.savedTasks} task${result.savedTasks === 1 ? '' : 's'}`
      + (result.savedMeetings ? ` and ${result.savedMeetings} meeting${result.savedMeetings === 1 ? '' : 's'}` : '')
      + (result.skipped.length ? `. Left existing work alone: ${result.skipped.join(', ')}.` : '.'),
    );
  };

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <AiBanner title="Planner" body="Describe the project. You review every task before anything is saved." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {groups.filter((group) => group.status !== 'archived').map((group) => (
            <Chip
              key={group.id}
              label={group.name}
              active={group.id === groupId}
              onPress={() => {
                setGroupId(group.id);
                setOutcome(group.outcome || group.description || '');
                setDeadline(group.deadline ? parseDay(group.deadline) : null);
                setStartDate(group.starts_on ? parseDay(group.starts_on) : parseDay(todayDay()));
              }}
            />
          ))}
        </ScrollView>
        <Field label="Desired outcome" value={outcome} onChangeText={setOutcome} multiline placeholder="What should be true when this project is done?" />
        <DateField label="Start date" value={startDate} onChange={setStartDate} />
        <DateField label="Deadline" value={deadline} onChange={setDeadline} />
        <Field label="Default hours each person can give per week" value={hours} onChangeText={setHours} keyboardType="number-pad" />
        <Field label="Constraints and blockers" value={constraints} onChangeText={setConstraints} multiline placeholder="Exams, parts on order, skills the team does not have" />
        <Field label="Milestones, one per line" value={milestones} onChangeText={setMilestones} multiline placeholder={'Prototype chassis | 2026-11-10\nDemo video'} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button title={plan ? 'Build again' : 'Build plan'} onPress={() => void build()} busy={busy === 'build'} disabled={busy === 'save'} />

        {plan ? (
          <View>
            <Section>Proposed schedule</Section>
            <Card style={plan.source === 'ai' ? styles.aiCard : styles.builtinCard}>
              <Pill tone={plan.source === 'ai' ? 'active' : 'medium'}>
                {plan.source === 'ai' ? 'Remote planner' : 'Built-in planner'}
              </Pill>
              <Text style={styles.sourceNote}>
                {plan.source === 'ai'
                  ? 'This draft came from the remote planner. Nothing is saved until you approve it.'
                  : 'This draft came from the built-in planner. Nothing is saved until you approve it.'}
              </Text>
              <Text style={styles.summary}>{plan.summary}</Text>
              {plan.notices.map((notice) => (
                <Text key={notice} style={styles.note}>{notice}</Text>
              ))}
              <View style={styles.pillGap}>
                <Pill tone={plan.feasible ? 'done' : 'blocked'}>
                  {plan.feasible ? 'Feasible' : 'Does not fit'}
                </Pill>
              </View>
            </Card>
            {plan.assumptions.length ? <Section>Assumptions</Section> : null}
            {plan.assumptions.map((item) => <Text key={item} style={styles.note}>{item}</Text>)}
            {plan.risks.length ? <Section>Risks</Section> : null}
            {plan.risks.map((item) => <Text key={item} style={styles.risk}>{item}</Text>)}
            <Section>Tasks to review</Section>
            <Text style={styles.lead}>Included tasks are saved. Skipped tasks stay off the project.</Text>
            {plan.tasks.map((task, index) => (
              <Card key={`${task.title}-${index}`} style={included[index] ? styles.keep : styles.skip}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.note}>{task.phase} · {task.assigneeName} · {task.estimatedMinutes} min · due {task.dueDate}</Text>
                {task.microGoals.length ? <Text style={styles.note}>{task.microGoals.join(' · ')}</Text> : null}
                <Chip
                  label={included[index] ? 'Included' : 'Skipped'}
                  active={Boolean(included[index])}
                  onPress={() => setIncluded((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))}
                />
              </Card>
            ))}
            <Section>Meetings</Section>
            <Card>
              <Text style={styles.note}>These are proposals. They are not added to the calendar unless you include them.</Text>
              {plan.meetings.map((meeting) => (
                <Text key={meeting.title} style={styles.note}>{meeting.title}: {meeting.reason}</Text>
              ))}
              <Chip label={includeMeetings ? 'Include meetings' : 'Leave meetings off'} active={includeMeetings} onPress={() => setIncludeMeetings((value) => !value)} />
            </Card>
            <Button title="Save reviewed plan" onPress={() => void save()} busy={busy === 'save'} disabled={busy === 'build'} />
          </View>
        ) : null}
        {savedNote ? (
          <Card>
            <Text style={styles.summary}>{savedNote}</Text>
            <Button title="Back to the project" onPress={() => router.back()} secondary />
          </Card>
        ) : null}
      </ScrollView>
    </Page>
  );
}

function createStyles(colors: AppColors) {
  return {
  lead: { color: colors.muted, fontSize: type.body, lineHeight: 22, marginBottom: 12 },
  row: { gap: 8, paddingBottom: 12 },
  summary: { color: colors.ink, fontWeight: '700' as const, marginTop: 8, lineHeight: 22, fontSize: type.body },
  note: { color: colors.muted, fontSize: type.caption, lineHeight: 18, marginTop: 6 },
  risk: { color: colors.warning, fontSize: type.caption, lineHeight: 18, marginTop: 6 },
  pillGap: { marginTop: 10 },
  taskTitle: { color: colors.ink, fontWeight: '700' as const, fontSize: type.body },
  sourceNote: { color: colors.muted, fontSize: type.caption, lineHeight: 18, marginTop: 8 },
  aiCard: { borderColor: colors.blue },
  builtinCard: { borderColor: colors.primary },
  keep: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  skip: { opacity: 0.72 },
} as const;
}

