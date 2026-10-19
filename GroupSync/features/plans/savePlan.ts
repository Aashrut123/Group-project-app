import type { GeneratedPlan, PlanMeeting, PlanTask } from '@/lib/planner/types';
import { supabase } from '@/lib/supabase';

export interface SavePlanResult {
  savedTasks: number;
  skipped: string[];
  savedMeetings: number;
  error?: string;
}

function dayStart(day: string, hour: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year || 2026, (month || 1) - 1, date || 1, hour, 0, 0, 0).toISOString();
}

export async function saveReviewedPlan(options: {
  groupId: string;
  plan: GeneratedPlan;
  tasks: PlanTask[];
  meetings: PlanMeeting[];
  input: unknown;
}): Promise<SavePlanResult> {
  const existing = await supabase.from('tasks').select('id,title,status').eq('group_id', options.groupId);
  if (existing.error) return { savedTasks: 0, skipped: [], savedMeetings: 0, error: existing.error.message };
  const existingTitles = new Set(
    ((existing.data ?? []) as { title: string }[]).map((task) => task.title.trim().toLowerCase()),
  );

  const session = await supabase
    .from('planning_sessions')
    .insert({
      group_id: options.groupId,
      source: options.plan.source,
      feasible: options.plan.feasible,
      summary: options.plan.summary,
      assumptions: options.plan.assumptions.join('\n'),
      risks: options.plan.risks.join('\n'),
      input: options.input,
      plan: options.plan,
      saved_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (session.error || !session.data) {
    return { savedTasks: 0, skipped: [], savedMeetings: 0, error: session.error?.message ?? 'Could not save the planning session.' };
  }

  const skipped: string[] = [];
  const idByTitle = new Map<string, string>();
  let savedTasks = 0;

  for (const milestone of options.plan.milestones) {
    const inserted = await supabase.from('milestones').insert({
      group_id: options.groupId,
      title: milestone.title,
      due_on: milestone.dueDate,
      description: 'Added from a reviewed project plan.',
    });
    if (inserted.error) return { savedTasks, skipped, savedMeetings: 0, error: inserted.error.message };
  }

  for (const task of options.tasks) {
    const key = task.title.trim().toLowerCase();
    if (task.alreadyTracked || existingTitles.has(key)) {
      skipped.push(task.title);
      continue;
    }
    const inserted = await supabase
      .from('tasks')
      .insert({
        group_id: options.groupId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: 'todo',
        due_at: dayStart(task.dueDate, 17),
        starts_at: dayStart(task.startDate, 9),
        estimated_minutes: task.estimatedMinutes,
        origin: options.plan.source,
        plan_id: session.data.id,
      })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) {
      return { savedTasks, skipped, savedMeetings: 0, error: inserted.error?.message ?? 'Could not save a task.' };
    }
    savedTasks += 1;
    existingTitles.add(key);
    idByTitle.set(key, inserted.data.id as string);
    if (task.assigneeId) {
      const assignment = await supabase.from('task_assignments').insert({
        task_id: inserted.data.id,
        user_id: task.assigneeId,
      });
      if (assignment.error) {
        return { savedTasks, skipped, savedMeetings: 0, error: `Task saved, but assignment failed: ${assignment.error.message}` };
      }
    }
    if (task.microGoals.length) {
      const goals = await supabase.from('requirements').insert(
        task.microGoals.map((title) => ({ task_id: inserted.data.id, title })),
      );
      if (goals.error) {
        return { savedTasks, skipped, savedMeetings: 0, error: `Task saved, but micro-goals failed: ${goals.error.message}` };
      }
    }
  }

  for (const task of options.tasks) {
    const childId = idByTitle.get(task.title.trim().toLowerCase());
    if (!childId) continue;
    for (const dependencyTitle of task.dependsOnTitles) {
      const parentId = idByTitle.get(dependencyTitle.trim().toLowerCase());
      if (!parentId) continue;
      const link = await supabase.from('task_dependencies').insert({ task_id: childId, depends_on: parentId });
      if (link.error) {
        return { savedTasks, skipped, savedMeetings: 0, error: link.error.message };
      }
    }
  }

  let savedMeetings = 0;
  for (const meeting of options.meetings) {
    const event = await supabase
      .from('events')
      .insert({
        group_id: options.groupId,
        title: meeting.title,
        description: meeting.agenda,
        starts_at: meeting.startsAt,
        ends_at: meeting.endsAt,
        kind: 'meeting',
        location: '',
      })
      .select('id')
      .single();
    if (event.error || !event.data) {
      return { savedTasks, skipped, savedMeetings, error: event.error?.message ?? 'Could not save a meeting.' };
    }
    const row = await supabase.from('meetings').insert({
      group_id: options.groupId,
      event_id: event.data.id,
      title: meeting.title,
      agenda: meeting.agenda,
      description: meeting.reason,
      starts_at: meeting.startsAt,
      ends_at: meeting.endsAt,
    });
    if (row.error) return { savedTasks, skipped, savedMeetings, error: row.error.message };
    savedMeetings += 1;
  }

  return { savedTasks, skipped, savedMeetings };
}
