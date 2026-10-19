import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, EmptyState, Page } from '@/components/ui';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import type { AppNotification } from '@/types/database';

export default function NotificationsScreen() {
  const { notifications, refresh } = useWorkspace();
  const [error, setError] = useState('');

  const open = async (item: AppNotification) => {
    if (!item.read_at) {
      const { error: issue } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
      if (issue) setError(issue.message);
      else await refresh();
    }
    if (item.href.startsWith('/task/') || item.href.startsWith('/group/')) {
      router.push(item.href as '/task/[id]' | '/group/[id]');
    }
  };

  const markAll = async () => {
    const unread = notifications.filter((item) => !item.read_at).map((item) => item.id);
    if (!unread.length) return;
    const { error: issue } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread);
    if (issue) setError(issue.message);
    else await refresh();
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <Text style={styles.lead}>These are in-app notices stored for your account. GroupSync is not sending push notifications.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notifications.length ? notifications.map((item) => (
          <Card key={item.id}>
            <Text onPress={() => void open(item)} style={[styles.title, !item.read_at && styles.unread]}>{item.title}</Text>
            <Text onPress={() => void open(item)} style={styles.body}>{item.body}</Text>
            <Text style={styles.meta}>{formatDate(item.created_at)}{item.read_at ? '' : ' · New'}</Text>
          </Card>
        )) : (
          <EmptyState title="No notices yet" body="Assignments, progress logs, and meetings will show up here after the latest database migration is applied." />
        )}
        {notifications.some((item) => !item.read_at) ? <Button title="Mark all read" onPress={() => void markAll()} secondary /> : null}
      </ScrollView>
    </Page>
  );
}

const styles = {
  lead: { color: theme.colors.muted, lineHeight: 20, marginBottom: 12 },
  title: { color: theme.colors.ink, fontWeight: '700' as const, fontSize: 15 },
  unread: { fontWeight: '800' as const },
  body: { color: theme.colors.muted, marginTop: 4, lineHeight: 18 },
  meta: { color: theme.colors.faint, marginTop: 6, fontSize: 12 },
  error: { color: theme.colors.red, marginBottom: 8 },
};
