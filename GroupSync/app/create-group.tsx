import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';

import { DateField } from '@/components/DateField';
import {
  Button,
  Chip,
  ErrorText,
  Field,
  Page,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { PLANNING_STYLES, suggestedMilestones } from '@/lib/goals';
import { formatDay } from '@/lib/planner/dates';

import { useWorkspace } from '@/hooks/useWorkspace';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

const colors = [
  '#2B7168',
  '#5578B8',
  '#C66A54',
  '#8A68A8',
  '#C59130',
];

export default function CreateGroupScreen() {
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const { profile } = useAuth();
  const { refresh } = useWorkspace();
  const suggestions = suggestedMilestones(profile?.goals, profile?.custom_goal);
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosenMilestones = picked ?? suggestions;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [color, setColor] = useState(colors[0]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!name.trim()) {
      setError('Add a name for your project.');
      return;
    }
    setBusy(true);
    setError('');

    const payload = {
      name: name.trim(),
      description: description.trim(),
      color,
      outcome: outcome.trim(),
      deadline: deadline ? formatDay(deadline) : null,
      starts_on: new Date().toISOString().slice(0, 10),
      priority: 'medium',
      status: 'active',
    };
    let warning = '';
    let { data: created, error: issue } = await supabase.from('groups').insert(payload).select('id').single();
    if (issue && /outcome|deadline|starts_on|priority|status/.test(issue.message)) {
      const fallback = await supabase.from('groups').insert({
        name: payload.name,
        description: payload.description,
        color,
      }).select('id').single();
      created = fallback.data;
      issue = fallback.error;
      warning = 'The project was created. Apply the latest database migration to store the outcome and deadline.';
    }

    if (!issue && created && chosenMilestones.length) {
      const milestoneRows = await supabase.from('milestones').insert(
        chosenMilestones.map((title) => ({ group_id: created.id, title })),
      );
      if (milestoneRows.error) {
        warning = warning || `The project was created, but milestones were not saved: ${milestoneRows.error.message}`;
      }
    }

    setBusy(false);

    if (issue) {
      setError(issue.message);
      return;
    }

    await refresh();

    Alert.alert(
      'Project created',
      warning || 'Your project is ready. Open it to invite your teammates.'
    );

    if (fresh === '1') router.replace('/(tabs)');
    else router.back();
  };

  return (
    <Page>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field
          label="Group name"
          placeholder="e.g. AP Physics project"
          value={name}
          onChangeText={setName}
          maxLength={70}
        />

        <Field
          label="Description"
          placeholder="What is this group working on?"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={400}
        />

        <Field
          label="Intended outcome"
          placeholder="What does done look like?"
          value={outcome}
          onChangeText={setOutcome}
          multiline
        />

        <DateField label="Deadline" value={deadline} onChange={setDeadline} />
        {profile?.planning_style ? (
          <Text style={styles.hint}>{PLANNING_STYLES.find((item) => item.id === profile.planning_style)?.detail}</Text>
        ) : null}
        {suggestions.length ? (
          <>
            <Text style={styles.label}>Suggested milestones</Text>
            <Text style={styles.hint}>These come from your goals. Turn off any you do not want. They are saved only when you create the project.</Text>
            <View style={styles.choices}>
              {suggestions.map((title) => (
                <Chip
                  key={title}
                  label={title}
                  active={chosenMilestones.includes(title)}
                  onPress={() => {
                    const current = picked ?? suggestions;
                    setPicked(current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.label}>Group color</Text>

        <Text style={styles.colors}>
          {colors.map(value => (
            <Text
              key={value}
              onPress={() => setColor(value)}
              style={{
                color: value,
                fontSize: 25,
                marginRight: 15,
              }}
            >
              {color === value ? '●' : '○'}
            </Text>
          ))}
        </Text>

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Button
          title={busy ? 'Creating…' : 'Create group'}
          onPress={() => void create()}
          disabled={busy}
        />
      </ScrollView>
    </Page>
  );
}

const styles = {
  label: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  hint: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 8,
  },
  choices: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 12,
  },
  colors: {
    marginTop: 10,
    marginBottom: 15,
  },
};