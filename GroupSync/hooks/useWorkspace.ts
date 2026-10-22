import { useEffect, useState } from 'react';

import {
  loadAvailability,
  loadEvents,
  loadGroups,
  loadNotifications,
  loadProgressLogs,
  loadTasks,
  subscribeToGroupData,
} from '@/features/data/queries';
import { supabase } from '@/lib/supabase';
import type {
  AppNotification,
  AvailabilityWindow,
  CalendarEvent,
  Group,
  ProgressLog,
  Task,
  TaskStatus,
  UnavailablePeriod,
} from '@/types/database';

type WorkspaceSnapshot = {
  groups: Group[];
  events: CalendarEvent[];
  tasks: Task[];
  logs: ProgressLog[];
  notifications: AppNotification[];
  windows: AvailabilityWindow[];
  unavailable: UnavailablePeriod[];
  loading: boolean;
  error: string;
};

const empty: WorkspaceSnapshot = {
  groups: [],
  events: [],
  tasks: [],
  logs: [],
  notifications: [],
  windows: [],
  unavailable: [],
  loading: true,
  error: '',
};

let snapshot: WorkspaceSnapshot = empty;
const listeners = new Set<(value: WorkspaceSnapshot) => void>();
let refreshId = 0;
let started = false;

function emit(next: WorkspaceSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

function patchTasks(tasks: Task[]) {
  emit({ ...snapshot, tasks });
}

export async function refreshWorkspace() {
  const id = ++refreshId;
  try {
    const [groups, events, tasks] = await Promise.all([loadGroups(), loadEvents(), loadTasks()]);
    const [logs, notifications, availability] = await Promise.allSettled([
      loadProgressLogs(),
      loadNotifications(),
      loadAvailability(),
    ]);
    if (id !== refreshId) return;
    emit({
      groups,
      events,
      tasks,
      logs: logs.status === 'fulfilled' ? logs.value : [],
      notifications: notifications.status === 'fulfilled' ? notifications.value : [],
      windows: availability.status === 'fulfilled' ? availability.value.windows : [],
      unavailable: availability.status === 'fulfilled' ? availability.value.unavailable : [],
      loading: false,
      error: '',
    });
  } catch (cause) {
    if (id !== refreshId) return;
    emit({
      ...snapshot,
      loading: false,
      error: cause instanceof Error ? cause.message : 'Could not load your workspace.',
    });
  }
}

/** Writes finished or not-finished once, then every screen reading the workspace sees it. */
export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const previous = snapshot.tasks;
  patchTasks(previous.map((task) => (task.id === taskId ? { ...task, status } : task)));
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
  if (error) {
    patchTasks(previous);
    throw new Error(error.message);
  }
  await refreshWorkspace();
}

function ensureStarted() {
  if (started) return;
  started = true;
  void refreshWorkspace();
  subscribeToGroupData(() => {
    void refreshWorkspace();
  });
}

export function useWorkspace() {
  const [state, setState] = useState(snapshot);

  useEffect(() => {
    listeners.add(setState);
    ensureStarted();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { ...state, refresh: refreshWorkspace };
}
