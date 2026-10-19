import { daySpan, parseDay } from './dates';
import type { GeneratedPlan, PlanPriority, PlannerInput, PlanTask } from './types';

const priorities: PlanPriority[] = ['low', 'medium', 'high'];

export interface ValidationOk<T> {
  ok: true;
  value: T;
}

export interface ValidationErr {
  ok: false;
  error: string;
}

export type Validation<T> = ValidationOk<T> | ValidationErr;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function validatePlannerInput(input: PlannerInput): Validation<PlannerInput> {
  const title = text(input.title, 120);
  if (!title) return { ok: false, error: 'Add a project title (120 characters or fewer).' };
  const outcome = text(input.outcome, 2000);
  if (!outcome) return { ok: false, error: 'Describe the outcome you want the team to reach.' };
  const start = parseDay(input.startDate);
  const deadline = parseDay(input.deadline);
  if (!start || !deadline) return { ok: false, error: 'Enter a valid start date and deadline (YYYY-MM-DD).' };
  if (deadline < start) return { ok: false, error: 'The deadline has to be on or after the start date.' };
  if (daySpan(start, deadline) > 366) {
    return { ok: false, error: 'Plans are limited to one year so the schedule stays realistic.' };
  }
  if (!priorities.includes(input.priority)) {
    return { ok: false, error: 'Choose a low, medium, or high priority.' };
  }
  if (!Number.isFinite(input.weeklyHoursDefault) || input.weeklyHoursDefault < 1 || input.weeklyHoursDefault > 40) {
    return { ok: false, error: 'Default weekly hours must be between 1 and 40.' };
  }
  if (!input.members.length) return { ok: false, error: 'Add at least one teammate, including yourself.' };
  for (const member of input.members) {
    if (!text(member.id, 80) || !text(member.name, 80)) {
      return { ok: false, error: 'Every teammate needs a name.' };
    }
    if (!Number.isFinite(member.weeklyHours) || member.weeklyHours < 1 || member.weeklyHours > 40) {
      return { ok: false, error: `${member.name} needs weekly hours between 1 and 40.` };
    }
    for (const block of member.unavailable) {
      const blockStart = parseDay(block.start);
      const blockEnd = parseDay(block.end);
      if (!blockStart || !blockEnd || blockEnd < blockStart) {
        return { ok: false, error: `Unavailable dates for ${member.name} are invalid.` };
      }
    }
  }
  if (input.constraints.length > 2000) {
    return { ok: false, error: 'Constraints must be 2000 characters or fewer.' };
  }
  return {
    ok: true,
    value: {
      ...input,
      title,
      outcome,
      startDate: input.startDate.slice(0, 10),
      deadline: input.deadline.slice(0, 10),
      constraints: input.constraints.trim(),
      milestones: input.milestones
        .map((item) => ({ title: item.title.trim(), date: item.date?.slice(0, 10) }))
        .filter((item) => item.title.length > 0 && item.title.length <= 140),
    },
  };
}

function parseTask(value: unknown, members: { id: string; name: string }[]): Validation<PlanTask> {
  const record = asRecord(value);
  if (!record) return { ok: false, error: 'A task in the plan was not an object.' };
  const title = text(record.title, 160);
  if (!title) return { ok: false, error: 'A generated task is missing a title.' };
  const description = typeof record.description === 'string' ? record.description.trim().slice(0, 2000) : '';
  const phase = text(record.phase, 80) ?? 'Build';
  const priority = priorities.includes(record.priority as PlanPriority)
    ? (record.priority as PlanPriority)
    : 'medium';
  const estimated = Number(record.estimatedMinutes);
  if (!Number.isFinite(estimated) || estimated < 15 || estimated > 60 * 40) {
    return { ok: false, error: `Task “${title}” has an unrealistic duration.` };
  }
  const startDate = typeof record.startDate === 'string' ? record.startDate.slice(0, 10) : '';
  const dueDate = typeof record.dueDate === 'string' ? record.dueDate.slice(0, 10) : '';
  if (!parseDay(startDate) || !parseDay(dueDate)) {
    return { ok: false, error: `Task “${title}” has an invalid date.` };
  }
  if ((parseDay(dueDate) as Date) < (parseDay(startDate) as Date)) {
    return { ok: false, error: `Task “${title}” ends before it starts.` };
  }
  let assigneeId: string | null = null;
  let assigneeName = 'Unassigned';
  if (typeof record.assigneeId === 'string' && record.assigneeId) {
    const member = members.find((item) => item.id === record.assigneeId);
    if (member) {
      assigneeId = member.id;
      assigneeName = member.name;
    }
  }
  const dependsOnTitles = Array.isArray(record.dependsOnTitles)
    ? record.dependsOnTitles.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
  const microGoals = Array.isArray(record.microGoals)
    ? record.microGoals.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 180)).slice(0, 6)
    : [];
  return {
    ok: true,
    value: {
      title,
      description,
      phase,
      assigneeId,
      assigneeName,
      priority,
      estimatedMinutes: Math.round(estimated),
      startDate,
      dueDate,
      dependsOnTitles,
      microGoals,
      alreadyTracked: record.alreadyTracked === true,
    },
  };
}

export function parseGeneratedPlan(value: unknown, members: { id: string; name: string }[]): Validation<GeneratedPlan> {
  const record = asRecord(value);
  if (!record) return { ok: false, error: 'The planner response was not a JSON object.' };
  if (!Array.isArray(record.tasks) || record.tasks.length === 0) {
    return { ok: false, error: 'The planner did not return any tasks.' };
  }
  if (record.tasks.length > 40) return { ok: false, error: 'The planner returned too many tasks.' };
  const tasks: PlanTask[] = [];
  for (const item of record.tasks) {
    const parsed = parseTask(item, members);
    if (!parsed.ok) return parsed;
    tasks.push(parsed.value);
  }
  const titles = new Set(tasks.map((task) => task.title.toLowerCase()));
  if (titles.size !== tasks.length) return { ok: false, error: 'The planner returned duplicate task titles.' };
  for (const task of tasks) {
    for (const dependency of task.dependsOnTitles) {
      if (!titles.has(dependency.toLowerCase())) {
        return { ok: false, error: `Task “${task.title}” depends on “${dependency}”, which is not in the plan.` };
      }
      if (dependency.toLowerCase() === task.title.toLowerCase()) {
        return { ok: false, error: `Task “${task.title}” cannot depend on itself.` };
      }
    }
  }
  const phases = Array.isArray(record.phases)
    ? record.phases.flatMap((item) => {
        const phase = asRecord(item);
        const name = phase ? text(phase.name, 80) : null;
        if (!phase || !name) return [];
        return [{ name, summary: typeof phase.summary === 'string' ? phase.summary.slice(0, 400) : '' }];
      })
    : [];
  const milestones = Array.isArray(record.milestones)
    ? record.milestones.flatMap((item) => {
        const milestone = asRecord(item);
        const title = milestone ? text(milestone.title, 140) : null;
        const dueDate = milestone && typeof milestone.dueDate === 'string' ? milestone.dueDate.slice(0, 10) : '';
        if (!title || !parseDay(dueDate)) return [];
        return [{ title, dueDate }];
      })
    : [];
  const meetings = Array.isArray(record.meetings)
    ? record.meetings.flatMap((item) => {
        const meeting = asRecord(item);
        if (!meeting) return [];
        const title = text(meeting.title, 120);
        const startsAt = typeof meeting.startsAt === 'string' ? meeting.startsAt : '';
        const endsAt = typeof meeting.endsAt === 'string' ? meeting.endsAt : '';
        if (!title || Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) return [];
        if (Date.parse(endsAt) <= Date.parse(startsAt)) return [];
        return [{
          title,
          agenda: typeof meeting.agenda === 'string' ? meeting.agenda.slice(0, 1000) : '',
          startsAt,
          endsAt,
          reason: typeof meeting.reason === 'string' ? meeting.reason.slice(0, 300) : '',
        }];
      })
    : [];
  const list = (key: string) =>
    Array.isArray(record[key])
      ? record[key].filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 400)).slice(0, 12)
      : [];
  return {
    ok: true,
    value: {
      source: 'ai',
      notices: [],
      feasible: record.feasible !== false,
      summary: typeof record.summary === 'string' ? record.summary.trim().slice(0, 800) : '',
      assumptions: list('assumptions'),
      risks: list('risks'),
      phases,
      milestones,
      tasks,
      meetings,
    },
  };
}
