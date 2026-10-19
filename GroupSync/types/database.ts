export type GroupRole = 'owner' | 'admin' | 'member';
export type EventKind = 'event' | 'meeting' | 'deadline';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  color: string;
  created_by: string;
  created_at: string;
}

export interface Membership {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  profile?: Profile;
}

export interface CalendarEvent {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  location: string;
  color: string | null;
  kind: EventKind;
  group?: Group;
}

export interface Task {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  group?: Group;
  assignments?: { user_id: string; profile?: Profile }[];
}

export interface Requirement {
  id: string;
  task_id: string;
  title: string;
  description: string;
  due_at: string | null;
  assigned_to: string | null;
  completed: boolean;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
}
