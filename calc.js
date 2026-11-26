(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var num = function (v) { v = parseFloat(v); return isFinite(v) && v > 0 ? v : 0; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  // monthly total of expense list; each item {amount, period:'m'|'y'}
  function monthlyExpenses(items) {
    return (items || []).reduce(function (s, it) {
      var a = num(it.amount);
      return s + (it.period === 'y' ? a / 12 : a);
    }, 0);
  }

  // s: {takeHome, expenses[], taxPct, deductible, marginPct, feePct,
  //     hoursPerWeek, nonBillablePct, weeksOff, hoursPerDay}
  function compute(s) {
    var E = monthlyExpenses(s.expenses);
    var N = num(s.takeHome);
    var t = clamp(num(s.taxPct), 0, 90) / 100;
    var m = clamp(num(s.marginPct), 0, 200) / 100;
    var f = clamp(num(s.feePct), 0, 60) / 100;
    var hpw = clamp(num(s.hoursPerWeek), 0, 100);
    var nb = clamp(num(s.nonBillablePct), 0, 95) / 100;
    var off = clamp(num(s.weeksOff), 0, 51);
    var hpd = clamp(num(s.hoursPerDay), 0, 16) || 0;

    var tax, afterTax;
    var revenue; // monthly revenue the client side must pay you (before margin & fee)
    if (s.deductible) revenue = N / (1 - t) + E; else revenue = (N + E) / (1 - t);
    var buffer = revenue * m;
    var net = revenue + buffer;                // what must land in your account
    var gross = net / (1 - f);                 // what clients must pay (platform keeps fee)
    var fee = gross - net;
    // tax actually paid on the planned numbers
    tax = s.deductible ? (revenue - E) * t : revenue * t;

    var billableWeeks = 52 - off;
    var monthlyHours = hpw * (1 - nb) * billableWeeks / 12;
    var hourly = monthlyHours > 0 ? gross / monthlyHours : 0;
    var daily = hourly * (hpd || (hpw / 5) * (1 - nb));
    return {
      expensesMonthly: E, takeHome: N, tax: tax, buffer: buffer, fee: fee,
      revenueNeeded: gross, monthlyHours: monthlyHours, billableWeeks: billableWeeks,
      hourly: hourly, daily: daily, yearly: gross * 12,
      parts: { takeHome: N, expenses: E, tax: tax, buffer: buffer, fee: fee },
      valid: monthlyHours > 0 && N + E > 0
    };
  }

  // quote: {hours, rate, revisionPct, rushPct, discountPct, fixedCosts}
  function quote(q) {
    var h = num(q.hours), r = num(q.rate);
    var base = h * r;
    var rev = base * clamp(num(q.revisionPct), 0, 300) / 100;
    var rush = (base + rev) * clamp(num(q.rushPct), 0, 300) / 100;
    var fixed = num(q.fixedCosts);
    var sub = base + rev + rush + fixed;
    var disc = sub * clamp(num(q.discountPct), 0, 90) / 100;
    var total = sub - disc;
    return { base: base, revisions: rev, rush: rush, fixed: fixed, subtotal: sub,
      discount: disc, total: total, effectiveHourly: h > 0 ? total / h : 0 };
  }

  // client budget check against floor rate
  function verdict(budget, hours, floorRate) {
    var b = num(budget), h = num(hours);
    if (!b || !h || !floorRate) return { eff: 0, status: 'none', gap: 0 };
    var eff = b / h;
    var ratio = eff / floorRate;
    var status = ratio < 0.85 ? 'below' : ratio < 1 ? 'close' : 'ok';
    return { eff: eff, status: status, ratio: ratio, gap: (floorRate * h) - b };
  }

  function round(v, step) { step = step || 1; return Math.round(v / step) * step; }

  return { num: num, monthlyExpenses: monthlyExpenses, compute: compute, quote: quote,
    verdict: verdict, round: round };
});
