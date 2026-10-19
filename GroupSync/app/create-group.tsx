import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';

import { router } from 'expo-router';

import { DateField } from '@/components/DateField';
import {
  Button,
  ErrorText,
  Field,
  Page,
} from '@/components/ui';
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
  const { refresh } = useWorkspace();

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
    let { error: issue } = await supabase.from('groups').insert(payload);
    if (issue && /outcome|deadline|starts_on|priority|status/.test(issue.message)) {
      const fallback = await supabase.from('groups').insert({
        name: payload.name,
        description: payload.description,
        color,
      });
      issue = fallback.error;
      warning = 'The project was created. Apply the latest database migration to store the outcome and deadline.';
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

    router.back();
  };

  return (
    <Page>
      <ScrollView keyboardShouldPersistTaps="handled">
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
    fontWeight: '700',
    marginTop: 8,
  },

  colors: {
    marginTop: 10,
    marginBottom: 15,
  },
} as const;