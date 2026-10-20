import assert from 'node:assert/strict';
import test from 'node:test';

import { goalSummary, phasesForFocus, suggestedMilestones } from './goals.ts';

test('goals suggest milestones without duplicates', () => {
  const titles = suggestedMilestones(['school', 'school'], '  Demo video  ');
  assert.deepEqual(titles.slice(0, 2), ['Research notes', 'Draft']);
  assert.equal(titles.at(-1), 'Demo video');
  assert.equal(new Set(titles).size, titles.length);
});

test('unknown goals do not invent a summary', () => {
  assert.equal(goalSummary(['missing'], ''), '');
  assert.equal(goalSummary(['competition'], ''), 'Competition team');
  assert.equal(phasesForFocus('software', 30)?.[0]?.name, 'Scope');
  assert.equal(phasesForFocus(undefined, 30), null);
});
