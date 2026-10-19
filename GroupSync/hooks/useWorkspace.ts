import { useCallback, useEffect, useState } from 'react';

import {
  loadAvailability,
  loadEvents,
  loadGroups,
  loadNotifications,
  loadProgressLogs,
  loadTasks,
  subscribeToGroupData,
} from '@/features/data/queries';
import type {
  AppNotification,
  AvailabilityWindow,
  CalendarEvent,
  Group,
  ProgressLog,
  Task,
  UnavailablePeriod,
} from '@/types/database';

export function useWorkspace() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailablePeriod[]>([]);
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
      const [nextLogs, nextNotifications, nextAvailability] = await Promise.allSettled([
        loadProgressLogs(),
        loadNotifications(),
        loadAvailability(),
      ]);
      setLogs(nextLogs.status === 'fulfilled' ? nextLogs.value : []);
      setNotifications(nextNotifications.status === 'fulfilled' ? nextNotifications.value : []);
      if (nextAvailability.status === 'fulfilled') {
        setWindows(nextAvailability.value.windows);
        setUnavailable(nextAvailability.value.unavailable);
      } else {
        setWindows([]);
        setUnavailable([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your workspace.');
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

  return { groups, events, tasks, logs, notifications, windows, unavailable, loading, error, refresh };
}
