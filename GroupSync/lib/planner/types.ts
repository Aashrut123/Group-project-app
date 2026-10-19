export type PlanPriority = 'low' | 'medium' | 'high';
export type PlanSource = 'ai' | 'fallback';
export type WorkflowStatus = 'todo' | 'in_progress' | 'blocked' | 'completed';

export interface UnavailableRange {
  start: string;
  end: string;
}

export interface PlannerMember {
  id: string;
  name: string;
  skills: string;
  weeklyHours: number;
  /** 0 = Sunday … 6 = Saturday. Empty means any weekday is acceptable. */
  availableWeekdays: number[];
  unavailable: UnavailableRange[];
}

export interface PlannerMilestone {
  title: string;
  date?: string;
}

export interface ExistingTask {
  title: string;
  status: WorkflowStatus | 'in_progress';
  assigneeId?: string | null;
  estimatedMinutes?: number;
}

export interface PlannerInput {
  title: string;
  outcome: string;
  startDate: string;
  deadline: string;
  priority: PlanPriority;
  weeklyHoursDefault: number;
  constraints: string;
  milestones: PlannerMilestone[];
  members: PlannerMember[];
  existingTasks: ExistingTask[];
}

export interface PlanTask {
  title: string;
  description: string;
  phase: string;
  assigneeId: string | null;
  assigneeName: string;
  priority: PlanPriority;
  estimatedMinutes: number;
  startDate: string;
  dueDate: string;
  dependsOnTitles: string[];
  microGoals: string[];
  alreadyTracked: boolean;
}

export interface PlanMeeting {
  title: string;
  agenda: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface GeneratedPlan {
  source: PlanSource;
  notices: string[];
  feasible: boolean;
  summary: string;
  assumptions: string[];
  risks: string[];
  phases: { name: string; summary: string }[];
  milestones: { title: string; dueDate: string }[];
  tasks: PlanTask[];
  meetings: PlanMeeting[];
}

export interface RescheduleTask {
  id: string;
  title: string;
  status: WorkflowStatus;
  dueDate: string | null;
  assigneeId: string | null;
  estimatedMinutes: number;
  dependsOn: string[];
}

export interface RescheduleChange {
  id: string;
  title: string;
  from: string | null;
  to: string;
  reason: string;
}

export interface RescheduleProposal {
  feasible: boolean;
  explanation: string;
  changes: RescheduleChange[];
  unchangedCompleted: string[];
  tradeoffs: string[];
}
