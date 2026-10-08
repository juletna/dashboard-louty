import assert from 'node:assert/strict';
import { test } from 'node:test';
import { salaryCapacityAtDate, projectedPlanResult } from '../src/app/domain/annual-cap.js';
const year = { months_present:[1,2,3], monthly:{ marge_brute:[1000,1000,500], charges_fonct:[100,100,50], contribution_coop:[20,20,10], remunerations:[9000,9000,9000] } };
test('salary capacity uses actual margin and costs, ignoring paid salary, with current month prorated', () => {
  const result = salaryCapacityAtDate(year, '2026', 3, '2026-03-15T12:00:00', 0.65);
  assert.equal(result.availableGross, 2200);
  assert.equal(result.elapsedMonths, 2 + 15 / 31);
  assert.equal(result.monthlyNet, 2200 * 0.65 / (2 + 15 / 31));
});
test('completed months remain full when the export is later; missing dates and coverage stay unavailable', () => {
  assert.equal(salaryCapacityAtDate(year, '2026', 3, '2026-04-15', 0.65).elapsedMonths, 3);
  assert.equal(salaryCapacityAtDate(year, '2026', 3, null, 0.65).monthlyNet, null);
  assert.equal(salaryCapacityAtDate(year, '2026', 3, 'invalid', 0.65).monthlyNet, null);
  assert.equal(salaryCapacityAtDate({ ...year, months_present:[1,3] }, '2026', 3, '2026-03-15', 0.65).monthlyNet, null);
  assert.equal(salaryCapacityAtDate({ ...year, monthly:{ ...year.monthly, charges_fonct:[null,null,null] } }, '2026', 3, '2026-03-15', 0.65).monthlyNet, null);
});
test('zero and negative capacity are distinguished from unavailable metrics', () => {
  for (const margin of [300, 0, -50]) {
    const data = { months_present:[1], monthly:{ marge_brute:[margin], charges_fonct:[250], contribution_coop:[50] } };
    const result = salaryCapacityAtDate(data, '2026', 1, '2026-01-31', 0.65);
    assert.equal(result.monthlyNet, 0);
    assert.equal(result.availableGross, margin - 300);
  }
});
test('annual result preserves losses and uses planned annual salary and costs', () => {
  const plan = { salary:30000, charges:15000 };
  assert.equal(projectedPlanResult(60000, plan), 15000);
  assert.equal(projectedPlanResult(40000, plan), -5000);
  assert.equal(projectedPlanResult(null, plan), null);
});
test('contribution is never taken below the historical share of margin', () => {
  const data = { months_present:[1,2,3], monthly:{ marge_brute:[1000,1000,1000], charges_fonct:[100,100,100], contribution_coop:[20,20,null] } };
  const estimated = salaryCapacityAtDate(data, '2026', 3, '2026-04-15', 0.65, 0.1);
  assert.equal(estimated.contributionBooked, 40);
  assert.equal(estimated.contribution, 300);
  assert.equal(estimated.contributionRate, 0.1);
  assert.equal(estimated.availableGross, 3000 - 300 - 300);
  const booked = salaryCapacityAtDate(data, '2026', 3, '2026-04-15', 0.65, 0.01);
  assert.equal(booked.contribution, 40);
  assert.equal(booked.contributionRate, null);
  assert.equal(salaryCapacityAtDate(data, '2026', 3, '2026-04-15', 0.65).contribution, 40);
});
test('a closing month with very low charges is flagged as incomplete', () => {
  const base = { months_present:[1,2,3,4], monthly:{ marge_brute:[1000,1000,1000,1000], charges_fonct:[100,120,110,10], contribution_coop:[0,0,0,0] } };
  assert.equal(salaryCapacityAtDate(base, '2026', 4, '2026-04-20', 0.65).incompleteMonth, 4);
  const normal = { ...base, monthly:{ ...base.monthly, charges_fonct:[100,120,110,90] } };
  assert.equal(salaryCapacityAtDate(normal, '2026', 4, '2026-04-20', 0.65).incompleteMonth, null);
  const early = { months_present:[1,2], monthly:{ marge_brute:[1000,1000], charges_fonct:[100,5], contribution_coop:[0,0] } };
  assert.equal(salaryCapacityAtDate(early, '2026', 2, '2026-02-20', 0.65).incompleteMonth, null);
});
