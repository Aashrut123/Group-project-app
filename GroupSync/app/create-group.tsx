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

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function CreateGroupScreen() {
  const params = useLocalSearchParams<{ fresh?: string; name?: string; outcome?: string }>();
  const fresh = params.fresh;
  const { profile } = useAuth();
  const { refresh } = useWorkspace();
  const suggestions = suggestedMilestones(profile?.goals, profile?.custom_goal);
  const [selected, setSelected] = useState<string[]>([]);
  const [customs, setCustoms] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState('');

  const [name, setName] = useState(firstParam(params.name));
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState(firstParam(params.outcome));
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [color, setColor] = useState(colors[0]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const options = [...suggestions, ...customs.filter((title) => !suggestions.some((item) => item.toLowerCase() === title.toLowerCase()))];

  const toggle = (title: string) => {
    setSelected((current) => (current.includes(title) ? current.filter((item) => item !== title) : [...current, title]));
  };

  const addCustom = () => {
    const title = customTitle.trim().slice(0, 140);
    if (!title) return;
    const existing = options.find((item) => item.toLowerCase() === title.toLowerCase());
    if (existing) {
      setSelected((current) => (current.includes(existing) ? current : [...current, existing]));
    } else {
      setCustoms((current) => [...current, title]);
      setSelected((current) => [...current, title]);
    }
    setCustomTitle('');
  };

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

    const pending = customTitle.trim().slice(0, 140);
    const chosen = options.filter((title) => selected.includes(title));
    if (pending && !chosen.some((title) => title.toLowerCase() === pending.toLowerCase())) chosen.push(pending);

    if (!issue && created && chosen.length) {
      const withOrder = chosen.map((title, index) => ({ group_id: created.id, title, sort_order: index }));
      let milestoneRows = await supabase.from('milestones').insert(withOrder);
      if (milestoneRows.error && /sort_order/.test(milestoneRows.error.message)) {
        milestoneRows = await supabase.from('milestones').insert(chosen.map((title) => ({ group_id: created.id, title })));
      }
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
        <Text style={styles.label}>Milestones</Text>
        <Text style={styles.hint}>Suggestions stay off until you tap them. Add your own, then create the project.</Text>
        {options.length ? (
          <View style={styles.choices}>
            {options.map((title) => (
              <Chip
                key={title}
                label={title}
                active={selected.includes(title)}
                onPress={() => toggle(title)}
              />
            ))}
          </View>
        ) : null}
        <Field
          label="Custom milestone"
          placeholder="e.g. Working prototype"
          value={customTitle}
          onChangeText={setCustomTitle}
          maxLength={140}
          onSubmitEditing={addCustom}
          returnKeyType="done"
        />
        <Button title="Add milestone" onPress={addCustom} secondary disabled={!customTitle.trim() || busy} />

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