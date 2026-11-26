const assert = require('node:assert');
const test = require('node:test');
const C = require('../calc.js');
const base = { takeHome: 20000, expenses: [{amount: 1000, period: 'm'}, {amount: 12000, period: 'y'}],
  taxPct: 10, deductible: false, marginPct: 0, feePct: 0, hoursPerWeek: 40, nonBillablePct: 25, weeksOff: 4, hoursPerDay: 6 };
const close = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) < e, a + ' != ' + b);

test('monthly expenses normalise yearly', () => close(C.monthlyExpenses(base.expenses), 2000));
test('non-deductible tax gross-up', () => {
  const r = C.compute(base); close(r.revenueNeeded, 22000 / 0.9);
  close(r.takeHome + r.expensesMonthly + r.tax, r.revenueNeeded);
});
test('deductible tax', () => {
  const r = C.compute({ ...base, deductible: true });
  close(r.revenueNeeded, 20000 / 0.9 + 2000);
  close(r.takeHome + r.expensesMonthly + r.tax, r.revenueNeeded);
});
test('hours: 40h * 75% * 48 weeks / 12', () => close(C.compute(base).monthlyHours, 120));
test('hourly and daily', () => {
  const r = C.compute(base); close(r.hourly, (22000 / 0.9) / 120); close(r.daily, r.hourly * 6);
});
test('margin and fee raise price', () => {
  const a = C.compute(base), b = C.compute({ ...base, marginPct: 10, feePct: 10 });
  assert.ok(b.hourly > a.hourly);
  close(b.revenueNeeded, a.revenueNeeded * 1.1 / 0.9);
  close(b.fee, b.revenueNeeded * 0.1);
});
test('more time off => higher hourly', () => {
  assert.ok(C.compute({ ...base, weeksOff: 10 }).hourly > C.compute(base).hourly);
});
test('zero hours is invalid, no NaN', () => {
  const r = C.compute({ ...base, hoursPerWeek: 0 });
  assert.equal(r.valid, false); assert.equal(r.hourly, 0);
});
test('garbage input is safe', () => {
  const r = C.compute({ takeHome: 'abc', expenses: [{ amount: -5 }], hoursPerWeek: '40' });
  assert.ok(Number.isFinite(r.hourly));
});
test('quote math', () => {
  const q = C.quote({ hours: 10, rate: 100, revisionPct: 20, rushPct: 25, discountPct: 10, fixedCosts: 50 });
  close(q.base, 1000); close(q.revisions, 200); close(q.rush, 300); close(q.subtotal, 1550);
  close(q.total, 1395); close(q.effectiveHourly, 139.5);
});
test('verdict', () => {
  assert.equal(C.verdict(500, 10, 100).status, 'below');
  assert.equal(C.verdict(950, 10, 100).status, 'close');
  assert.equal(C.verdict(1200, 10, 100).status, 'ok');
  close(C.verdict(500, 10, 100).gap, 500);
});
test('round', () => assert.equal(C.round(123.4, 5), 125));
test('quote clamps absurd percentages', () => {
  const q = C.quote({ hours: 1, rate: 100, discountPct: 500 });
  close(q.total, 10); assert.ok(q.total >= 0);
});
test('negative and blank values count as zero', () => {
  assert.equal(C.num(-4), 0); assert.equal(C.num(''), 0); assert.equal(C.num('12.5'), 12.5);
});
test('verdict with no floor is none', () => assert.equal(C.verdict(100, 10, 0).status, 'none'));
