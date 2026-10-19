import assert from 'node:assert/strict';
import test from 'node:test';

import { findConflicts, overloadedDays } from './conflicts.ts';
import { atLocalTime, formatDay, overlapsLocalDay } from './dates.ts';
import { buildFallbackPlan } from './fallback.ts';
import { canPromoteMember, canRemoveMember } from './permissions.ts';
import { acceptedChanges, proposeReschedule } from './reschedule.ts';
import { completionPercent, nextTaskStatus } from './status.ts';
import type { PlannerInput, PlannerMember, RescheduleTask } from './types.ts';
import { parseGeneratedPlan, validatePlannerInput } from './validate.ts';

const member = (id: string, name: string, extra: Partial<PlannerMember> = {}): PlannerMember => ({
  id,
  name,
  skills: '',
  weeklyHours: 6,
  availableWeekdays: [1, 2, 3, 4, 5],
  unavailable: [],
  ...extra,
});

const input = (extra: Partial<PlannerInput> = {}): PlannerInput => ({
  title: 'Robotics notebook',
  outcome: 'Ship a demo notebook the judges can follow.',
  startDate: '2026-11-02',
  deadline: '2026-11-20',
  priority: 'high',
  weeklyHoursDefault: 6,
  constraints: 'No meetings on Sundays.',
  milestones: [{ title: 'Prototype chassis', date: '2026-11-10' }],
  members: [member('a', 'Anish', { skills: 'chassis wiring' }), member('b', 'Aashrut', { skills: 'notebook writing' })],
  existingTasks: [{ title: 'Order parts', status: 'completed' }],
  ...extra,
});

test('local due times stay on the chosen calendar day', () => {
  const due = atLocalTime('2026-11-03', 17, 30);
  assert.ok(due);
  assert.equal(formatDay(due), '2026-11-03');
  assert.equal(due.getHours(), 17);
  assert.equal(due.getMinutes(), 30);
  assert.equal(atLocalTime('2026-02-31', 10), null);
  assert.equal(atLocalTime('2026-11-03', 24, 0), null);
});

test('task status moves through blocked before completed', () => {
  assert.equal(nextTaskStatus('todo'), 'in_progress');
  assert.equal(nextTaskStatus('in_progress'), 'blocked');
  assert.equal(nextTaskStatus('blocked'), 'completed');
  assert.equal(nextTaskStatus('completed'), 'todo');
});

test('completion uses tasks and milestones', () => {
  assert.equal(completionPercent([], []), 0);
  assert.equal(completionPercent([{ status: 'completed' }, { status: 'todo' }], []), 50);
  assert.equal(completionPercent([{ status: 'completed' }], [{ completed: false }]), 50);
});

test('membership rules match the database checks', () => {
  assert.equal(canRemoveMember('member', 'member', false).allowed, false);
  assert.equal(canRemoveMember('owner', 'owner', true).allowed, false);
  assert.equal(canRemoveMember('admin', 'admin', false).allowed, false);
  assert.equal(canRemoveMember('admin', 'member', false).allowed, true);
  assert.equal(canPromoteMember('owner', 'member'), true);
  assert.equal(canPromoteMember('admin', 'member'), false);
});

test('planner input rejects a deadline before the start', () => {
  const result = validatePlannerInput(input({ deadline: '2026-10-01' }));
  assert.equal(result.ok, false);
});

test('fallback plan avoids unavailable days and does not duplicate finished work', () => {
  const plan = buildFallbackPlan(input({
    members: [
      member('a', 'Anish', { unavailable: [{ start: '2026-11-02', end: '2026-11-06' }] }),
      member('b', 'Aashrut', { skills: 'notebook' }),
    ],
  }));
  assert.equal(plan.source, 'fallback');
  assert.ok(plan.tasks.length >= 3);
  assert.ok(plan.tasks.some((task) => task.assigneeId === 'b'));
  assert.equal(plan.tasks.some((task) => task.title === 'Order parts'), false);
  for (const task of plan.tasks) {
    if (task.assigneeId === 'a') {
      assert.ok(task.dueDate > '2026-11-06' || task.dueDate < '2026-11-02');
    }
  }
  assert.match(plan.summary, /hours|fit/i);
});

test('fallback plan is honest when the team has no days', () => {
  const plan = buildFallbackPlan(input({
    startDate: '2026-11-02',
    deadline: '2026-11-06',
    members: [member('a', 'Anish', { unavailable: [{ start: '2026-11-02', end: '2026-11-06' }] })],
  }));
  assert.equal(plan.feasible, false);
  assert.ok(plan.risks.length > 0);
});

test('AI responses must be structured and cannot invent dependencies', () => {
  const rejected = parseGeneratedPlan({ tasks: [{ title: 'Write' }] }, [{ id: 'a', name: 'Anish' }]);
  assert.equal(rejected.ok, false);
  const unknownDependency = parseGeneratedPlan({
    tasks: [{
      title: 'Write',
      description: 'Draft',
      phase: 'Build',
      assigneeId: 'missing',
      priority: 'high',
      estimatedMinutes: 60,
      startDate: '2026-11-03',
      dueDate: '2026-11-04',
      dependsOnTitles: ['Missing'],
      microGoals: ['Open the doc'],
    }],
  }, [{ id: 'a', name: 'Anish' }]);
  assert.equal(unknownDependency.ok, false);
  const accepted = parseGeneratedPlan({
    feasible: true,
    summary: 'Two steps.',
    assumptions: ['Hours are estimates.'],
    risks: [],
    phases: [{ name: 'Build', summary: 'Write it.' }],
    milestones: [],
    meetings: [],
    tasks: [{
      title: 'Write',
      description: 'Draft',
      phase: 'Build',
      assigneeId: 'missing',
      priority: 'high',
      estimatedMinutes: 60,
      startDate: '2026-11-03',
      dueDate: '2026-11-04',
      dependsOnTitles: [],
      microGoals: ['Open the doc'],
    }],
  }, [{ id: 'a', name: 'Anish' }]);
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(accepted.value.tasks[0]?.assigneeId, null);
});

test('reschedule keeps completed tasks and drops them from accepted updates', () => {
  const tasks: RescheduleTask[] = [
    { id: 'done', title: 'Research', status: 'completed', dueDate: '2026-11-03', assigneeId: 'a', estimatedMinutes: 60, dependsOn: [] },
    { id: 'next', title: 'Draft', status: 'todo', dueDate: '2026-11-04', assigneeId: 'a', estimatedMinutes: 90, dependsOn: ['done'] },
  ];
  const proposal = proposeReschedule({
    tasks,
    members: [member('a', 'Anish', { unavailable: [{ start: '2026-11-04', end: '2026-11-07' }] })],
    startDate: '2026-11-02',
    deadline: '2026-11-20',
    reason: 'Anish is out next week',
  });
  assert.deepEqual(proposal.unchangedCompleted, ['Research']);
  assert.equal(proposal.changes.some((change) => change.id === 'done'), false);
  const draft = proposal.changes.find((change) => change.id === 'next');
  assert.ok(draft);
  assert.ok((draft?.to ?? '') >= '2026-11-08');
  const applied = acceptedChanges(proposal, tasks, ['done', 'next']);
  assert.deepEqual(applied.map((item) => item.id), ['next']);
});

test('dependency cycles are reported instead of rewritten', () => {
  const proposal = proposeReschedule({
    tasks: [
      { id: 'a', title: 'A', status: 'todo', dueDate: null, assigneeId: 'a', estimatedMinutes: 30, dependsOn: ['b'] },
      { id: 'b', title: 'B', status: 'todo', dueDate: null, assigneeId: 'a', estimatedMinutes: 30, dependsOn: ['a'] },
    ],
    members: [member('a', 'Anish')],
    startDate: '2026-11-02',
    deadline: '2026-11-20',
    reason: 'cycle',
  });
  assert.equal(proposal.feasible, false);
  assert.equal(proposal.changes.length, 0);
});

test('conflicts ignore deadlines and catch unavailable overlaps', () => {
  const conflicts = findConflicts([
    { id: '1', title: 'Standup', start: '2026-11-03T16:00:00.000Z', end: '2026-11-03T17:00:00.000Z', kind: 'meeting' },
    { id: '2', title: 'Lab', start: '2026-11-03T16:30:00.000Z', end: '2026-11-03T18:00:00.000Z', kind: 'event' },
    { id: '3', title: 'Submit', start: '2026-11-03T16:30:00.000Z', end: '2026-11-03T16:30:00.000Z', kind: 'deadline' },
    { id: '4', title: 'Away', start: '2026-11-03T00:00:00.000Z', end: '2026-11-04T00:00:00.000Z', kind: 'unavailable' },
  ]);
  assert.equal(conflicts.some((item) => item.a === 'Submit' || item.b === 'Submit'), false);
  assert.equal(conflicts.some((item) => item.reason.includes('overlap')), true);
  assert.equal(conflicts.some((item) => item.reason.includes('unavailable')), true);
  assert.deepEqual(overloadedDays([
    { dueDate: '2026-11-03', estimatedMinutes: 90, status: 'todo' },
    { dueDate: '2026-11-03', estimatedMinutes: 90, status: 'completed' },
  ], 60), [{ day: '2026-11-03', minutes: 90 }]);
});

test('a meeting shows on the local day it occupies', () => {
  const day = new Date(2026, 9, 19);
  const start = new Date(2026, 9, 19, 16, 0, 0);
  const end = new Date(2026, 9, 19, 17, 0, 0);
  assert.equal(overlapsLocalDay(start.toISOString(), end.toISOString(), day), true);
  assert.equal(overlapsLocalDay(start.toISOString(), end.toISOString(), new Date(2026, 9, 20)), false);
  const late = new Date(2026, 9, 18, 23, 30, 0);
  const afterMidnight = new Date(2026, 9, 19, 0, 30, 0);
  assert.equal(overlapsLocalDay(late.toISOString(), afterMidnight.toISOString(), day), true);
});
