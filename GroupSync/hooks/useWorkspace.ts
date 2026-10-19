import { useCallback, useEffect, useState } from 'react';
import {
  loadEvents,
  loadGroups,
  loadTasks,
  subscribeToGroupData,
} from '@/features/data/queries';
import type { CalendarEvent, Group, Task } from '@/types/database';

export function useWorkspace() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');

    try {
      const [nextGroups, nextEvents, nextTasks] = await Promise.all([
        loadGroups(),
        loadEvents(),
        loadTasks(),
      ]);

      setGroups(nextGroups);
      setEvents(nextEvents);
      setTasks(nextTasks);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load your workspace.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);

    const unsubscribe = subscribeToGroupData(() => {
      void refresh();
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  return {
    groups,
    events,
    tasks,
    loading,
    error,
    refresh,
  };
}