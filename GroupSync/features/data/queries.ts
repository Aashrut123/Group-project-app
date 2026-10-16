import { supabase } from '@/lib/supabase';
import type { CalendarEvent, Group, Task } from '@/types/database';

export async function loadGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_memberships')
    .select('group:groups(*)')
    .order('joined_at', { ascending: false });

  if (error) throw error;

  const uniqueGroups = new Map<string, Group>();

  for (const row of data || []) {
    const group = (row as any).group as Group | null;

    if (group && !uniqueGroups.has(group.id)) {
      uniqueGroups.set(group.id, group);
    }
  }

  return Array.from(uniqueGroups.values());
}

export async function loadEvents(
  groupId?: string
): Promise<CalendarEvent[]> {
  let query = supabase
    .from('events')
    .select('*, group:groups(id,name,color)')
    .gte(
      'ends_at',
      new Date(Date.now() - 86400000).toISOString()
    )
    .order('starts_at');

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []) as CalendarEvent[];
}

export async function loadTasks(
  groupId?: string
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select(
      '*, group:groups(id,name,color), assignments:task_assignments(user_id)'
    )
    .order('created_at', { ascending: false });

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []) as Task[];
}

export function subscribeToGroupData(onChange: () => void) {
  const channel = supabase
    .channel(`groupsync-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'group_memberships' },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}