import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Card, Chip, ErrorText, Field, Page, Pill } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { GOAL_PRESETS, PLANNING_STYLES, goalSummary, type PlanningStyle } from '@/lib/goals';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

type StartPath = 'start' | 'join' | 'explore';

const FEATURES = [
  { title: 'A plan you can edit', body: 'A goal becomes milestones and tasks. You approve them before they are saved.' },
  { title: 'A next step', body: 'Home shows the open task that should come first.' },
  { title: 'One calendar', body: 'Deadlines and meetings stay together. Availability is optional and can wait.' },
  { title: 'Progress you record', body: 'Completion comes from finished tasks and the logs you write.' },
];

const PATHS: { id: StartPath; title: string; detail: string }[] = [
  { id: 'start', title: 'Start a project', detail: 'Name it now. Invite people later, or work on your own.' },
  { id: 'join', title: 'Join with a code', detail: 'Use an invitation from a project that already exists.' },
  { id: 'explore', title: 'Explore first', detail: 'Open Home and decide later. Nothing is created.' },
];

interface Draft {
  step: number;
  goals: string[];
  customGoal: string;
  style: PlanningStyle;
  path: StartPath;
  projectName: string;
  projectOutcome: string;
  code: string;
}

function storageKey(userId: string) {
  return `groupsync-onboarding:${userId}`;
}

export default function OnboardingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const { user, profile, refreshProfile } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const [ready, setReady] = useState(editing);
  const [step, setStep] = useState(editing ? 1 : 0);
  const [goals, setGoals] = useState<string[]>(profile?.goals ?? []);
  const [customGoal, setCustomGoal] = useState(profile?.custom_goal ?? '');
  const [style, setStyle] = useState<PlanningStyle>(profile?.planning_style ?? 'steady');
  const [path, setPath] = useState<StartPath>('explore');
  const [projectName, setProjectName] = useState('');
  const [projectOutcome, setProjectOutcome] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const steps = editing ? [1, 3] : [0, 1, 2, 3];
  const progress = Math.max(0, steps.indexOf(step));

  useEffect(() => {
    if (!user || editing) return;
    let active = true;
    void AsyncStorage.getItem(storageKey(user.id)).then((raw) => {
      if (!active || !raw) {
        if (active) setReady(true);
        return;
      }
      try {
        const saved = JSON.parse(raw) as Partial<Draft>;
        if (saved.step === 0 || saved.step === 1 || saved.step === 2 || saved.step === 3) setStep(saved.step);
        if (Array.isArray(saved.goals)) setGoals(saved.goals.filter((id) => typeof id === 'string').slice(0, 8));
        if (typeof saved.customGoal === 'string') setCustomGoal(saved.customGoal);
        if (saved.style === 'steady' || saved.style === 'sprint' || saved.style === 'flexible') setStyle(saved.style);
        if (saved.path === 'start' || saved.path === 'join' || saved.path === 'explore') setPath(saved.path);
        if (typeof saved.projectName === 'string') setProjectName(saved.projectName);
        if (typeof saved.projectOutcome === 'string') setProjectOutcome(saved.projectOutcome);
        if (typeof saved.code === 'string') setCode(saved.code);
      } catch {
        // A broken draft should not block onboarding.
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [user, editing]);

  useEffect(() => {
    if (!user || editing || !ready) return;
    const draft: Draft = { step, goals, customGoal, style, path, projectName, projectOutcome, code };
    void AsyncStorage.setItem(storageKey(user.id), JSON.stringify(draft));
  }, [user, editing, ready, step, goals, customGoal, style, path, projectName, projectOutcome, code]);

  const toggleGoal = (id: string) => {
    setGoals((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 8) return current;
      return [...current, id];
    });
  };

  const writeProfile = async (completed: boolean) => {
    if (!user) return 'Sign in again to save your choices.';
    const { error: issue } = await supabase.from('profiles').update({
      goals,
      custom_goal: customGoal.trim(),
      planning_style: style,
      ...(completed ? { onboarding_completed: true } : {}),
    }).eq('id', user.id);
    if (!issue) return '';
    return issue.message.includes('goals') || issue.message.includes('onboarding') || issue.message.includes('planning_style')
      ? 'Run the latest SQL migration in Supabase, then try again.'
      : issue.message;
  };

  const finish = async () => {
    if (!user) return;
    if (!editing && path === 'start' && !projectName.trim()) {
      setError('Add a project name, or go back and choose Explore first.');
      return;
    }
    if (!editing && path === 'join' && !code.trim()) {
      setError('Enter an invitation code, or go back and choose another start.');
      return;
    }
    setBusy(true);
    setError('');
    let joinedGroupId = '';
    if (!editing && path === 'join') {
      const joined = await supabase.rpc('join_group_with_code', { invitation_code: code.trim() });
      if (joined.error) {
        setBusy(false);
        setError(joined.error.message);
        return;
      }
      joinedGroupId = String(joined.data ?? '');
    }
    const message = await writeProfile(true);
    if (message) {
      setBusy(false);
      setError(message);
      return;
    }
    await AsyncStorage.removeItem(storageKey(user.id));
    await refreshProfile();
    setBusy(false);
    if (editing) {
      router.back();
      return;
    }
    if (path === 'start') {
      router.replace({
        pathname: '/create-group',
        params: { fresh: '1', name: projectName.trim(), outcome: projectOutcome.trim() },
      });
      return;
    }
    if (path === 'join' && joinedGroupId) {
      router.replace(`/group/${joinedGroupId}`);
      return;
    }
    router.replace('/(tabs)');
  };

  if (!ready) {
    return (
      <Page>
        <Text style={styles.body}>Loading your setup…</Text>
      </Page>
    );
  }

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.progress}>
          {steps.map((value) => (
            <View key={value} style={[styles.bar, value <= step && styles.barOn]} />
          ))}
        </View>
        <Text style={styles.step}>Step {progress + 1} of {steps.length}</Text>

        {step === 0 ? (
          <>
            <Text style={styles.title}>Big goals. Clear next steps.</Text>
            <Text style={styles.body}>
              Turn an idea into a plan, see what to do next, and keep a record of what actually got done. Start alone and invite people when you want them.
            </Text>
            <View style={[styles.features, wide && styles.featuresWide]}>
              {FEATURES.map((feature) => (
                <View key={feature.title} style={[styles.feature, wide && styles.featureWide]}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.note}>{feature.body}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.exampleLabel}>Example, not your data</Text>
            <Card>
              <Text style={styles.previewKicker}>Project</Text>
              <Text style={styles.previewTitle}>Ship the demo</Text>
              <Text style={styles.note}>Milestone · Working version</Text>
              <Text style={styles.previewTask}>Compare the core flow</Text>
              <Text style={styles.previewTask}>Record a two-minute walkthrough</Text>
              <View style={styles.previewPill}>
                <Pill>Next · Record a two-minute walkthrough</Pill>
              </View>
            </Card>
            <Text style={styles.note}>
              The built-in planner can draft a schedule for you to review. A remote AI planner is used only when it is configured.
            </Text>
            <Button title="Get started" onPress={() => setStep(1)} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.title}>What do you want to get done?</Text>
            <Text style={styles.body}>
              Pick one or more. These shape suggested milestones. They do not hide the rest of GroupSync, and you can change them from Profile.
            </Text>
            <View style={styles.choices}>
              {GOAL_PRESETS.map((goal) => (
                <Chip key={goal.id} label={goal.label} active={goals.includes(goal.id)} onPress={() => toggleGoal(goal.id)} />
              ))}
            </View>
            {goals.length >= 8 ? <Text style={styles.note}>You can save up to 8 goals.</Text> : null}
            {goals.map((id) => {
              const goal = GOAL_PRESETS.find((item) => item.id === id);
              return goal ? <Text key={id} style={styles.note}>{goal.label}: {goal.detail}</Text> : null;
            })}
            <Field
              label="Something else"
              value={customGoal}
              onChangeText={setCustomGoal}
              placeholder="Optional"
              maxLength={200}
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button title="Continue" onPress={() => { setError(''); setStep(editing ? 3 : 2); }} />
            {editing ? null : <Button title="Skip for now" onPress={() => { setError(''); setStep(2); }} secondary />}
            {editing ? null : <Button title="Back" onPress={() => setStep(0)} secondary />}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>How do you want to start?</Text>
            <Text style={styles.body}>Pick one. You can create or join a project later if you explore first.</Text>
            {PATHS.map((item) => (
              <Card key={item.id} style={path === item.id ? styles.pathOn : undefined}>
                <Text style={styles.featureTitle} onPress={() => { setPath(item.id); setError(''); }}>{item.title}</Text>
                <Text style={styles.note} onPress={() => { setPath(item.id); setError(''); }}>{item.detail}</Text>
              </Card>
            ))}
            {path === 'start' ? (
              <>
                <Field label="Project name" value={projectName} onChangeText={setProjectName} placeholder="e.g. Competition robot" maxLength={70} />
                <Field label="What does done look like?" value={projectOutcome} onChangeText={setProjectOutcome} placeholder="Optional" multiline />
              </>
            ) : null}
            {path === 'join' ? (
              <Field label="Invitation code" value={code} onChangeText={setCode} placeholder="Paste the code" autoCapitalize="none" />
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button title="Continue" onPress={() => {
              if (path === 'start' && !projectName.trim()) {
                setError('Add a project name, or choose Explore first.');
                return;
              }
              if (path === 'join' && !code.trim()) {
                setError('Enter an invitation code, or choose another start.');
                return;
              }
              setError('');
              setStep(3);
            }} />
            <Button title="Back" onPress={() => setStep(1)} secondary />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.title}>{editing ? 'Your goals' : 'Review and finish'}</Text>
            <Text style={styles.body}>
              {editing
                ? 'These goals and this pace stay on your profile. They suggest milestones and how the built-in planner spaces work.'
                : 'Nothing is created until you finish. A new project is confirmed on the next screen.'}
            </Text>
            <Card>
              <Text style={styles.featureTitle}>Goals</Text>
              <Text style={styles.note}>{goalSummary(goals, customGoal) || 'No goal selected. You can add one later.'}</Text>
              <Button title="Edit goals" onPress={() => setStep(1)} secondary />
            </Card>
            {editing ? null : (
              <Card>
                <Text style={styles.featureTitle}>Start</Text>
                <Text style={styles.note}>
                  {path === 'start' ? `New project: ${projectName.trim() || 'Unnamed'}${projectOutcome.trim() ? `. ${projectOutcome.trim()}` : ''}` : null}
                  {path === 'join' ? `Join with code ${code.trim() || '(missing)'}` : null}
                  {path === 'explore' ? 'Explore Home first. No project is created.' : null}
                </Text>
                <Button title="Change start" onPress={() => setStep(2)} secondary />
              </Card>
            )}
            <Text style={styles.section}>Planning pace</Text>
            <Text style={styles.note}>Optional. Steady spreads work evenly. Sprint pulls dates forward. Flexible keeps a longer buffer.</Text>
            <View style={styles.choices}>
              {PLANNING_STYLES.map((item) => (
                <Chip key={item.id} label={item.label} active={style === item.id} onPress={() => setStyle(item.id)} />
              ))}
            </View>
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button title={busy ? 'Saving…' : editing ? 'Save goals' : 'Finish'} onPress={() => void finish()} disabled={busy} />
            <Button title="Back" onPress={() => setStep(editing ? 1 : 2)} secondary />
          </>
        ) : null}
      </ScrollView>
    </Page>
  );
}

const styles = {
  scroll: { paddingBottom: 36 },
  progress: { flexDirection: 'row' as const, gap: 6, marginBottom: 10 },
  bar: { flex: 1, height: 4, borderRadius: 4, backgroundColor: theme.colors.line },
  barOn: { backgroundColor: theme.colors.primary },
  step: { color: theme.colors.faint, fontSize: 12, fontWeight: '700' as const, marginBottom: 12 },
  title: { color: theme.colors.ink, fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.4, marginBottom: 8 },
  body: { color: theme.colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  section: { color: theme.colors.ink, fontSize: 16, fontWeight: '800' as const, marginBottom: 6 },
  choices: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 },
  note: { color: theme.colors.muted, lineHeight: 20, marginBottom: 8 },
  features: { gap: 8, marginBottom: 16 },
  featuresWide: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  feature: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: 14,
  },
  featureWide: { width: '48%' as const },
  featureTitle: { color: theme.colors.ink, fontSize: 15, fontWeight: '800' as const, marginBottom: 4 },
  exampleLabel: { color: theme.colors.faint, fontSize: 12, fontWeight: '700' as const, marginBottom: 8 },
  previewKicker: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' as const },
  previewTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '800' as const, marginTop: 4 },
  previewTask: { color: theme.colors.ink, marginTop: 8 },
  previewPill: { marginTop: 12 },
  pathOn: { borderColor: theme.colors.primary },
};
