import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Chip, ErrorText, Field, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { GOAL_PRESETS, PLANNING_STYLES, type PlanningStyle } from '@/lib/goals';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function OnboardingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(editing ? 1 : 0);
  const [goals, setGoals] = useState<string[]>(profile?.goals ?? []);
  const [customGoal, setCustomGoal] = useState(profile?.custom_goal ?? '');
  const [style, setStyle] = useState<PlanningStyle>(profile?.planning_style ?? 'steady');
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const steps = editing ? [1, 2] : [0, 1, 2, 3];
  const progress = steps.indexOf(step);

  const toggleGoal = (id: string) => {
    setGoals((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const writeProfile = async (completed: boolean) => {
    if (!user) return 'Sign in again to save your goals.';
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

  const save = async (next: 'home' | 'project') => {
    if (!user) return;
    setBusy(true);
    setError('');
    const message = await writeProfile(true);
    if (message) {
      setBusy(false);
      setError(message);
      return;
    }
    if (!editing && days.length) {
      const existing = await supabase.from('availability_windows').select('id').eq('user_id', user.id).limit(1);
      if (!existing.error && !existing.data?.length) {
        const rows = days.map((weekday) => ({
          user_id: user.id,
          weekday,
          start_minute: 16 * 60,
          end_minute: 20 * 60,
        }));
        await supabase.from('availability_windows').insert(rows);
      }
    }
    await refreshProfile();
    setBusy(false);
    if (editing) {
      router.back();
      return;
    }
    if (next === 'project') router.replace({ pathname: '/create-group', params: { fresh: '1' } });
    else router.replace('/(tabs)');
  };

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.progress}>
          {steps.map((value) => (
            <View key={value} style={[styles.bar, value <= step && styles.barOn]} />
          ))}
        </View>
        <Text style={styles.step}>Step {progress + 1} of {steps.length}</Text>

        {step === 0 ? (
          <>
            <Text style={styles.title}>Plan the work your team can actually finish.</Text>
            <Text style={styles.body}>
              GroupSync turns a goal, the people involved, and the time you have into milestones, tasks, and a shared calendar. You can use it alone before anyone else joins.
            </Text>
            <Button title="Continue" onPress={() => setStep(1)} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.title}>What should GroupSync help you do?</Text>
            <Text style={styles.body}>Pick every goal that fits. You can change these later from Profile.</Text>
            <View style={styles.choices}>
              {GOAL_PRESETS.map((goal) => (
                <Chip key={goal.id} label={goal.label} active={goals.includes(goal.id)} onPress={() => toggleGoal(goal.id)} />
              ))}
            </View>
            {goals.map((id) => {
              const goal = GOAL_PRESETS.find((item) => item.id === id);
              return goal ? <Text key={id} style={styles.note}>{goal.label}: {goal.detail}</Text> : null;
            })}
            <Field
              label="Your own goal"
              value={customGoal}
              onChangeText={setCustomGoal}
              placeholder="Optional, if none of these fit"
              maxLength={200}
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button title="Continue" onPress={() => setStep(2)} />
            <Button title="Skip for now" onPress={() => { setGoals([]); setCustomGoal(''); setStep(2); }} secondary />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>How do you like to plan?</Text>
            <Text style={styles.body}>This changes the hints you see when you create a project. You can skip it.</Text>
            <View style={styles.choices}>
              {PLANNING_STYLES.map((item) => (
                <Chip key={item.id} label={item.label} active={style === item.id} onPress={() => setStyle(item.id)} />
              ))}
            </View>
            <Text style={styles.note}>{PLANNING_STYLES.find((item) => item.id === style)?.detail}</Text>
            {editing ? null : (
              <>
                <Text style={styles.section}>Days you can usually work</Text>
                <Text style={styles.body}>Optional. Selected days get a 4–8 pm window you can edit in Availability.</Text>
                <View style={styles.choices}>
                  {WEEKDAYS.map((label, index) => (
                    <Chip
                      key={label}
                      label={label}
                      active={days.includes(index)}
                      onPress={() => setDays((current) => current.includes(index) ? current.filter((day) => day !== index) : [...current, index])}
                    />
                  ))}
                </View>
              </>
            )}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button
              title={busy ? 'Saving…' : editing ? 'Save goals' : 'Continue'}
              disabled={busy}
              onPress={() => {
                if (editing) {
                  void save('home');
                  return;
                }
                void (async () => {
                  setBusy(true);
                  setError('');
                  const message = await writeProfile(false);
                  setBusy(false);
                  if (message) setError(message);
                  else {
                    await refreshProfile();
                    setStep(3);
                  }
                })();
              }}
            />
            <Button title="Back" onPress={() => setStep(1)} secondary />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.title}>Start with one project, or go straight home.</Text>
            <Text style={styles.body}>
              A project holds the deadline, milestones, and tasks. You do not need teammates yet. Nothing is created until you confirm it on the next screen.
            </Text>
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button title={busy ? 'Saving…' : 'Create a project'} onPress={() => void save('project')} disabled={busy} />
            <Button title="Go to home" onPress={() => void save('home')} secondary disabled={busy} />
            <Button title="Back" onPress={() => setStep(2)} secondary />
          </>
        ) : null}
      </ScrollView>
    </Page>
  );
}

const styles = {
  progress: { flexDirection: 'row' as const, gap: 6, marginBottom: 10 },
  bar: { flex: 1, height: 4, borderRadius: 4, backgroundColor: theme.colors.line },
  barOn: { backgroundColor: theme.colors.primary },
  step: { color: theme.colors.faint, fontSize: 12, fontWeight: '700' as const, marginBottom: 12 },
  title: { color: theme.colors.ink, fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4, marginBottom: 8 },
  body: { color: theme.colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  section: { color: theme.colors.ink, fontSize: 16, fontWeight: '800' as const, marginBottom: 6 },
  choices: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 },
  note: { color: theme.colors.muted, lineHeight: 20, marginBottom: 8 },
};
