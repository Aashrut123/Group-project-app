import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Page,
  Pill,
  Title,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatDate, formatTime } from '@/lib/format';
import { theme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { profile } = useAuth();

  const {
    groups,
    events,
    tasks,
    loading,
    error,
    refresh,
  } = useWorkspace();

  if (loading) {
    return <Loading />;
  }

  const upcoming = events.slice(0, 3);

  const dueTasks = tasks
    .filter(task => task.status !== 'completed')
    .slice(0, 4);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={styles.greeting}>
            <View>
              <Text style={styles.eyebrow}>
                YOUR STUDENT WORKSPACE
              </Text>

              <Text style={styles.greet}>
                Hey
                {profile?.display_name
                  ? `, ${profile.display_name.split(' ')[0]}`
                  : ''}{' '}
                👋
              </Text>
            </View>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.display_name?.[0]?.toUpperCase() ||
                  'G'}
              </Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>
              THIS WEEK
            </Text>

            <Text style={styles.heroTitle}>
              {upcoming.length} upcoming{' '}
              {upcoming.length === 1 ? 'event' : 'events'}
            </Text>

            <Text style={styles.heroSub}>
              {groups.length}{' '}
              {groups.length === 1 ? 'group' : 'groups'}{' '}
              connected to your calendar
            </Text>

            <Button
              title="Open master calendar"
              onPress={() =>
                router.push('/(tabs)/calendar')
              }
              secondary
            />
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          <View style={styles.sectionRow}>
            <Title subtitle="Across all of your groups">
              Coming up
            </Title>

            <Text
              style={styles.link}
              onPress={() =>
                router.push('/(tabs)/calendar')
              }
            >
              See all
            </Text>
          </View>

          {upcoming.length ? (
            upcoming.map(event => (
              <Card
                key={event.id}
                style={styles.rowCard}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        event.group?.color ||
                        theme.colors.primary,
                    },
                  ]}
                />

                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {event.title}
                  </Text>

                  <Text style={styles.rowMeta}>
                    {event.group?.name || 'Group'} ·{' '}
                    {formatDate(event.starts_at)} at{' '}
                    {formatTime(event.starts_at)}
                  </Text>
                </View>

                <Pill>{event.kind}</Pill>
              </Card>
            ))
          ) : (
            <EmptyState
              title="Nothing on the calendar yet"
              body="Create a group and add your first deadline or meeting."
            />
          )}

          <View
            style={[
              styles.sectionRow,
              { marginTop: 12 },
            ]}
          >
            <Title subtitle="The next things to move forward">
              Your tasks
            </Title>

            <Text
              style={styles.link}
              onPress={() => router.push('/(tabs)/tasks')}
            >
              See all
            </Text>
          </View>

          {dueTasks.length ? (
            dueTasks.map(task => (
              <Card
                key={task.id}
                style={styles.taskCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {task.title}
                  </Text>

                  <Text style={styles.rowMeta}>
                    {task.group?.name || 'Group'} ·{' '}
                    {formatDate(task.due_at)}
                  </Text>
                </View>

                <Pill
                  color={
                    task.priority === 'high'
                      ? '#FCE9E7'
                      : undefined
                  }
                >
                  {task.priority}
                </Pill>
              </Card>
            ))
          ) : (
            <EmptyState
              title="You're all caught up"
              body="Tasks assigned to you and your groups will show up here."
            />
          )}

          {!groups.length ? (
            <Card>
              <Text style={styles.rowTitle}>
                Get started
              </Text>

              <Text style={styles.rowMeta}>
                Create a group to bring your project team
                together.
              </Text>

              <Button
                title="Create your first group"
                onPress={() =>
                  router.push('/create-group')
                }
              />
            </Card>
          ) : null}

          <Button
            title="Refresh workspace"
            onPress={() => void refresh()}
            secondary
          />
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

const styles = {
  greeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  greet: {
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 5,
  },
  avatar: {
    width: 42,
    height: 42,
    backgroundColor: theme.colors.mint,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 17,
  },
  hero: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 20,
    padding: 20,
    marginBottom: 23,
  },
  heroEyebrow: {
    color: '#BCE1D7',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 11,
  },
  heroTitle: {
    color: 'white',
    fontWeight: '800',
    fontSize: 23,
    marginTop: 7,
  },
  heroSub: {
    color: '#D5E9E5',
    fontSize: 13,
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '800',
    marginTop: 5,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
  },
  dot: {
    width: 9,
    height: 38,
    borderRadius: 8,
  },
  rowTitle: {
    color: theme.colors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
} as const;
