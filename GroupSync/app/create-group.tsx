import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';

import { router } from 'expo-router';

import {
  Button,
  ErrorText,
  Field,
  Page,
} from '@/components/ui';

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
  const [color, setColor] = useState(colors[0]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!name.trim()) {
      setError('Add a name for your group.');
      return;
    }

    setBusy(true);
    setError('');

    const { error: issue } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        description: description.trim(),
        color,
      });

    setBusy(false);

    if (issue) {
      setError(issue.message);
      return;
    }

    await refresh();

    Alert.alert(
      'Group created',
      'Your group is ready. Open it to invite your teammates.'
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