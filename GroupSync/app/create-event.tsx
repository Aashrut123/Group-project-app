import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';

import { router } from 'expo-router';

import {
  Button,
  Card,
  ErrorText,
  Field,
  Page,
} from '@/components/ui';

import { useWorkspace } from '@/hooks/useWorkspace';
import { dateInputValue } from '@/lib/format';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

import type { EventKind } from '@/types/database';

const kinds: EventKind[] = ['event', 'meeting', 'deadline'];

export default function CreateEventScreen() {
  const { groups, refresh } = useWorkspace();

  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState<EventKind>('event');
  const [agenda, setAgenda] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!groupId) {
      setError('Choose a group first.');
      return;
    }

    if (!title.trim()) {
      setError('Add a title.');
      return;
    }

    const suggestedStart = new Date(Date.now() + 3600000);

    const start = new Date(
      startsAt || dateInputValue(suggestedStart)
    );

    const end = new Date(
      endsAt ||
        dateInputValue(
          new Date(suggestedStart.getTime() + 3600000)
        )
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setError(
        'Enter valid dates and make sure the end is after the start.'
      );
      return;
    }

    setBusy(true);
    setError('');

    const group = groups.find(
      item => item.id === groupId
    );

    const { data: event, error: issue } = await supabase
      .from('events')
      .insert({
        group_id: groupId,
        title: title.trim(),
        description: kind === 'meeting' && agenda.trim() ? agenda.trim() : description.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location: location.trim(),
        kind,
        color: group?.color || theme.colors.primary,
      })
      .select('id')
      .single();

    if (issue || !event) {
      setBusy(false);
      setError(issue?.message || 'Could not add the calendar item.');
      return;
    }

    if (kind === 'meeting') {
      const meeting = await supabase.from('meetings').insert({
        group_id: groupId,
        event_id: event.id,
        title: title.trim(),
        description: description.trim(),
        agenda: agenda.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location: location.trim(),
      });
      if (meeting.error) {
        setBusy(false);
        setError(`The calendar item was saved, but the meeting record failed: ${meeting.error.message}`);
        return;
      }
    }

    setBusy(false);

    await refresh();

    Alert.alert(
      'Added to calendar',
      `${title} is now on the ${group?.name || 'group'} calendar.`
    );

    router.back();
  };

  return (
    <Page>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <Text style={styles.label}>Group</Text>

        <Card style={styles.selectors}>
          {groups.map(group => (
            <Text
              key={group.id}
              onPress={() => setGroupId(group.id)}
              style={[
                styles.choice,
                groupId === group.id && styles.active,
              ]}
            >
              {group.name}
            </Text>
          ))}
        </Card>

        <Text style={styles.label}>Type</Text>

        <Card style={styles.selectors}>
          {kinds.map(value => (
            <Text
              key={value}
              onPress={() => setKind(value)}
              style={[
                styles.choice,
                kind === value && styles.active,
              ]}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Text>
          ))}
        </Card>

        <Field
          label="Title"
          placeholder="What is happening?"
          value={title}
          onChangeText={setTitle}
        />

        <Field
          label="Description"
          placeholder="Add details or an agenda"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Field
          label="Starts (local time)"
          value={startsAt}
          onChangeText={setStartsAt}
          placeholder="YYYY-MM-DDTHH:mm (defaults to one hour from now)"
        />

        <Field
          label="Ends (local time)"
          value={endsAt}
          onChangeText={setEndsAt}
          placeholder="YYYY-MM-DDTHH:mm (defaults to one hour later)"
        />

        {kind === 'meeting' ? (
          <Field
            label="Agenda"
            value={agenda}
            onChangeText={setAgenda}
            placeholder="What should the group decide?"
            multiline
          />
        ) : null}

        <Field
          label="Location or video link"
          value={location}
          onChangeText={setLocation}
          placeholder="Optional"
        />

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Button
          title={busy ? 'Saving…' : 'Add to calendar'}
          onPress={() => void create()}
          disabled={busy || !groups.length}
        />

        {!groups.length ? (
          <ErrorText>
            Create a group before adding calendar items.
          </ErrorText>
        ) : null}
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

  selectors: {
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