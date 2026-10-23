
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  Button,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Page,
  ProgressBar,
  Title,
} from '@/components/ui';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useWorkspace } from '@/hooks/useWorkspace';
import { completionPercent } from '@/lib/planner/status';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { AppColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types/database';
import { SafeAreaView } from 'react-native-safe-area-context';

function projectMembers(groupId: string, tasks: Task[]) {
  const seen = new Map<string, string>();
  for (const task of tasks) {
    if (task.group_id !== groupId) continue;
    for (const assignment of task.assignments ?? []) {
      if (!seen.has(assignment.user_id)) seen.set(assignment.user_id, assignment.profile?.display_name || '');
    }
  }
  return Array.from(seen, ([id, name]) => ({ id, name })).slice(0, 4);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

export default function GroupsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { groups, tasks, loading, error, refresh } = useWorkspace();
  const { refreshControl } = usePullRefresh(refresh);

  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [joinError, setJoinError] = useState('');

  if (loading) {
    return <Loading />;
  }

  const join = async () => {
    if (!code.trim()) {
      return;
    }

    setWorking(true);
    setJoinError('');

    const { error: joinIssue } = await supabase.rpc(
      'join_group_with_code',
      {
        invitation_code: code.trim(),
      }
    );

    setWorking(false);

    if (joinIssue) {
      setJoinError(joinIssue.message);
    } else {
      setCode('');
      await refresh();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={refreshControl}
        >
          <Title subtitle="Clubs, teams, and shared deadlines">Projects</Title>
          <Button title="Create a group" onPress={() => router.push('/create-group')} style={styles.create} />

          {error ? <ErrorText>{error}</ErrorText> : null}

          {groups.filter((group) => group.status !== 'archived').length ? (
            groups.filter((group) => group.status !== 'archived').map(group => {
              const groupTasks = tasks.filter((task) => task.group_id === group.id);
              const percent = completionPercent(groupTasks);
              const members = projectMembers(group.id, tasks);
              return (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                accessibilityLabel={group.name}
                onPress={() => router.push(`/group/${group.id}`)}
                style={({ pressed }) => [styles.group, pressed && styles.pressed]}
              >
                <View style={styles.nameRow}>
                  <View style={[styles.dot, { backgroundColor: group.color || colors.primary }]} />
                  <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
                  <Text style={styles.percent}>{percent}%</Text>
                </View>
                {group.description ? <Text style={styles.desc} numberOfLines={2}>{group.description}</Text> : null}
                <Text style={styles.meta}>{group.deadline ? `Due ${formatDate(group.deadline)}` : 'No deadline'}</Text>
                <ProgressBar value={percent} color={group.color || colors.primary} />
                {members.length ? (
                  <View style={styles.avatars}>
                    {members.map((member, index) => (
                      <View key={member.id} style={[styles.avatar, index > 0 && styles.avatarOverlap]}>
                        <Text style={styles.avatarText}>{initials(member.name)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
              );
            })
          ) : (
            <EmptyState compact title="No projects yet" body="Create one, or join with an invitation code." />
          )}

          <View style={styles.join}>
            <Text style={styles.joinTitle}>Join with a code</Text>
            <Text style={styles.desc}>Use the invitation a teammate sent you.</Text>
            <Field
              label="Invitation code"
              placeholder="Paste code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
            />
            {joinError ? <ErrorText>{joinError}</ErrorText> : null}
            <Button title="Join project" onPress={() => void join()} busy={working} secondary style={styles.joinButton} />
          </View>
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return {
    create: { marginTop: 0, marginBottom: 16 },
    group: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, marginBottom: 10 },
    pressed: { opacity: 0.82 },
    nameRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    name: { flex: 1, color: colors.text, fontWeight: '700' as const, fontSize: 18, letterSpacing: -0.3 },
    percent: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' as const },
    desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
    meta: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
    avatars: { flexDirection: 'row' as const, marginTop: 12 },
    avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.mint, borderWidth: 2, borderColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
    avatarOverlap: { marginLeft: -8 },
    avatarText: { color: colors.onMint, fontSize: 10, fontWeight: '700' as const },
    join: { marginTop: 8, backgroundColor: colors.mutedSurface, borderRadius: 18, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
    joinTitle: { color: colors.text, fontSize: 16, fontWeight: '700' as const },
    joinButton: { marginTop: 0 },
  } as const;
}

