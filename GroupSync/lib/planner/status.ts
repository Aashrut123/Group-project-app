import type { WorkflowStatus } from './types';

const order: WorkflowStatus[] = ['todo', 'in_progress', 'blocked', 'completed'];

export function nextTaskStatus(current: WorkflowStatus): WorkflowStatus {
  const index = order.indexOf(current);
  return order[(index + 1) % order.length] ?? 'todo';
}

export function isOpenStatus(status: string): boolean {
  return status !== 'completed';
}

export function taskStatusLabel(status: string): string {
  if (status === 'completed') return 'Finished';
  if (status === 'in_progress') return 'In progress';
  if (status === 'blocked') return 'Blocked';
  return 'Not started';
}

export function completionPercent(
  tasks: { status: string }[],
  milestones: { completed: boolean }[] = [],
): number {
  const taskScore = tasks.length
    ? tasks.filter((task) => task.status === 'completed').length / tasks.length
    : null;
  const milestoneScore = milestones.length
    ? milestones.filter((item) => item.completed).length / milestones.length
    : null;
  if (taskScore == null && milestoneScore == null) return 0;
  if (taskScore == null) return Math.round((milestoneScore ?? 0) * 100);
  if (milestoneScore == null) return Math.round(taskScore * 100);
  return Math.round(((taskScore + milestoneScore) / 2) * 100);
}
