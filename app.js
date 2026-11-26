(function () {
'use strict';
var KEY = 'ta3rifa.v1';
var $ = function (id) { return document.getElementById(id); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var DEF = { lang: 'ar', theme: 'auto', currency: 'EGP', takeHome: 15000, expenses: [{ name: 'إنترنت', amount: 500, period: 'm' }],
  hoursPerWeek: 40, weeksOff: 5, nonBillablePct: 30, hoursPerDay: 5, taxPct: 10, feePct: 0, marginPct: 10, deductible: true, roundTo: 5,
  q: { client: '', project: '', hours: 20, rate: '', rev: 20, rush: 0, fixed: 0, disc: 0, budget: '' }, quotes: [] };
var S;
function load() {
  try { var r = JSON.parse(localStorage.getItem(KEY)); if (r && typeof r === 'object') return merge(JSON.parse(JSON.stringify(DEF)), r); } catch (e) {}
  return JSON.parse(JSON.stringify(DEF));
}
function merge(a, b) { Object.keys(b).forEach(function (k) { if (b[k] !== undefined && b[k] !== null) a[k] = (typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) ? merge(a[k], b[k]) : b[k]; }); return a; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
var T = function (k) { return window.I18N[S.lang][k]; };
var N = function (v, d) { return new Intl.NumberFormat(S.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { maximumFractionDigits: d || 0 }).format(v || 0); };
var cur = function () { return window.CURRENCIES[S.currency][S.lang]; };
var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var money = function (v) { return N(v) + ' ' + cur(); };
function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 1800); }

var COLORS = { takeHome: '#1b998b', expenses: '#14213d', tax: '#e4572e', buffer: '#f2b134', fee: '#8d6a9f' };
var calc;
function settings() { return { takeHome: S.takeHome, expenses: S.expenses, taxPct: S.taxPct, deductible: S.deductible, marginPct: S.marginPct, feePct: S.feePct, hoursPerWeek: S.hoursPerWeek, nonBillablePct: S.nonBillablePct, weeksOff: S.weeksOff, hoursPerDay: S.hoursPerDay }; }

function applyLang() {
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  document.title = S.lang === 'ar' ? 'تعريفة · Ta3rifa' : 'Ta3rifa · freelancer rate calculator';
  $$('[data-i]').forEach(function (e) { var v = T(e.getAttribute('data-i')); if (typeof v === 'string') e.textContent = v; });
  $$('[data-ph]').forEach(function (e) { e.placeholder = T(e.getAttribute('data-ph')); });
  $('lang').textContent = S.lang === 'ar' ? 'EN' : 'ع';
  var p = $('expPer'); p.options[0].textContent = T('per_m'); p.options[1].textContent = T('per_y');
  var c = $('currency'); c.innerHTML = Object.keys(window.CURRENCIES).map(function (k) { return '<option value="' + k + '">' + window.CURRENCIES[k][S.lang] + (S.lang === 'ar' ? ' (' + k + ')' : '') + '</option>'; }).join(''); c.value = S.currency;
  $('presets').innerHTML = window.PRESETS[S.lang].map(function (p, i) { return '<button type="button" class="chip pre" data-p="' + i + '">+ ' + esc(p[0]) + '</button>'; }).join('');
  if (S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
}

function renderExpenses() {
  $('expList').innerHTML = S.expenses.map(function (e, i) {
    return '<li><span class="en">' + esc(e.name || T('untitled')) + '</span><span class="ea">' + N(e.amount) + ' <small>' + cur() + ' · ' + T('per_' + e.period) + '</small></span><button type="button" class="x" data-del="' + i + '" aria-label="' + T('remove') + '">×</button></li>';
  }).join('');
}

function render() {
  var c = window.Calc; calc = c.compute(settings());
  $$('.cur').forEach(function (e) { e.textContent = cur(); });
  $('expMonthly').textContent = money(calc.expensesMonthly);
  $('nbOut').textContent = S.nonBillablePct + '%'; $('mOut').textContent = S.marginPct + '%';
  var r = Math.max(1, +S.roundTo || 1);
  var hourly = calc.valid ? c.round(calc.hourly, r) : 0;
  calc.hourlyR = hourly; calc.dailyR = calc.valid ? c.round(calc.daily, r) : 0;
  $('hourly').textContent = N(hourly); $('miniV').textContent = N(hourly); $('daily').textContent = N(calc.dailyR); $('monthly').textContent = N(calc.revenueNeeded); $('yearly').textContent = N(calc.yearly);
  var w = $('warn'), msg = '';
  if (!calc.valid) msg = T('warnNeed'); else if (hourly > 5000 * (S.currency === 'EGP' ? 1 : 0.1)) msg = T('warnHigh');
  w.hidden = !msg; w.textContent = msg;
  // breakdown
  var tot = calc.revenueNeeded || 1, keys = ['takeHome', 'expenses', 'tax', 'buffer', 'fee'];
  $('bar').innerHTML = calc.valid ? keys.map(function (k) { var p = calc.parts[k] / tot * 100; return p > 0 ? '<i style="width:' + p + '%;background:' + COLORS[k] + '" title="' + T('p_' + k) + '"></i>' : ''; }).join('') : '';
  $('bar').setAttribute('aria-label', T('whereGoes'));
  $('legend').innerHTML = keys.map(function (k) { var p = calc.parts[k]; return p > 0 || k === 'takeHome' ? '<li><span class="dot" style="background:' + COLORS[k] + '"></span><span>' + T('p_' + k) + '</span><b>' + (calc.valid ? N(p / tot * 100) + '%' : '0%') + '</b><em>' + money(p) + '</em></li>' : ''; }).join('');
  var sold = S.hoursPerWeek * (1 - S.nonBillablePct / 100);
  $('realityTxt').textContent = calc.valid ? T('realityTxt')({ hpw: N(S.hoursPerWeek, 1), sold: N(sold, 1), weeks: calc.billableWeeks, hours: N(calc.monthlyHours, 1), rate: N(hourly), cur: cur() }) : '';
  renderQuote(); save();
}

function qvals() { var q = S.q; return window.Calc.quote({ hours: q.hours, rate: q.rate, revisionPct: q.rev, rushPct: q.rush, discountPct: q.disc, fixedCosts: q.fixed }); }
function renderQuote() {
  var q = S.q, r = qvals();
  $('rDate').textContent = new Date().toLocaleDateString(S.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');
  $('rWho').textContent = [q.client, q.project].filter(Boolean).join(' · ');
  var lines = [['base', r.base], ['rev', r.revisions], ['rush', r.rush], ['fixed', r.fixed]].filter(function (l, i) { return i === 0 || l[1] > 0; });
  if (r.discount > 0) lines.push(['disc', -r.discount]);
  $('rLines').innerHTML = lines.map(function (l) { return '<div><dt>' + T('l_' + l[0]) + (l[0] === 'base' ? ' <small>' + N(q.hours, 1) + T('hh') + ' × ' + N(q.rate, 1) + '</small>' : '') + '</dt><dd>' + (l[1] < 0 ? '−' : '') + N(Math.abs(l[1])) + '</dd></div>'; }).join('');
  $('rTotal').textContent = money(r.total); $('rEff').textContent = money(r.effectiveHourly);
  var v = window.Calc.verdict(q.budget, q.hours, calc ? calc.hourly : 0), el = $('verdict');
  if (v.status === 'none') { el.hidden = true; } else {
    el.hidden = false; el.className = 'verdict ' + v.status;
    el.textContent = T({ ok: 'vOk', close: 'vClose', below: 'vBelow' }[v.status])({ eff: N(v.eff), gap: N(Math.max(0, v.gap)), cur: cur() });
  }
}

function bindNum(id, get, set) { var e = $(id); e.value = get(); e.addEventListener('input', function () { set(e.value === '' ? '' : parseFloat(e.value)); render(); }); }
function init() {
  S = load(); applyLang();
  var m = [['takeHome'], ['hoursPerWeek'], ['weeksOff'], ['nonBillablePct'], ['hoursPerDay'], ['taxPct'], ['feePct'], ['marginPct']];
  m.forEach(function (a) { bindNum(a[0], function () { return S[a[0]]; }, function (v) { S[a[0]] = v; }); });
  [['qHours', 'hours'], ['qRate', 'rate'], ['qRev', 'rev'], ['qRush', 'rush'], ['qFixed', 'fixed'], ['qDisc', 'disc'], ['qBudget', 'budget']].forEach(function (a) { bindNum(a[0], function () { return S.q[a[1]]; }, function (v) { S.q[a[1]] = v; }); });
  [['qClient', 'client'], ['qProject', 'project']].forEach(function (a) { var e = $(a[0]); e.value = S.q[a[1]]; e.addEventListener('input', function () { S.q[a[1]] = e.value; render(); }); });
  $('deductible').checked = !!S.deductible; $('deductible').onchange = function () { S.deductible = this.checked; render(); };
  $('roundTo').value = String(S.roundTo); $('roundTo').onchange = function () { S.roundTo = +this.value; render(); };
  $('currency').onchange = function () { S.currency = this.value; renderExpenses(); render(); };
  $('lang').onclick = function () { S.lang = S.lang === 'ar' ? 'en' : 'ar'; applyLang(); renderExpenses(); renderSaved(); render(); };
  $('theme').onclick = function () { var dark = document.documentElement.getAttribute('data-theme') === 'dark'; S.theme = dark ? 'light' : 'dark'; applyLang(); save(); };
  $$('.tabs button').forEach(function (b) { b.onclick = function () { showTab(b.dataset.tab); }; });
  $('expForm').onsubmit = function (ev) {
    ev.preventDefault(); var a = parseFloat($('expAmt').value); if (!(a > 0)) { $('expAmt').focus(); return; }
    S.expenses.push({ name: $('expName').value.trim(), amount: a, period: $('expPer').value }); $('expName').value = ''; $('expAmt').value = ''; renderExpenses(); render();
  };
  $('expList').onclick = function (ev) { var d = ev.target.getAttribute && ev.target.getAttribute('data-del'); if (d !== null && d !== undefined) { S.expenses.splice(+d, 1); renderExpenses(); render(); } };
  $('presets').onclick = function (ev) { var i = ev.target.getAttribute && ev.target.getAttribute('data-p'); if (i === null || i === undefined) return; var p = window.PRESETS[S.lang][+i]; S.expenses.push({ name: p[0], amount: p[1], period: p[2] }); renderExpenses(); render(); };
  function useRate() { S.q.rate = calc.hourlyR; $('qRate').value = S.q.rate; render(); }
  $('useRate').onclick = function () { useRate(); showTab('quote'); };
  $('qFromRate').onclick = useRate;
  $('copyRate').onclick = function () { copy(T('summary')({ hourly: N(calc.hourlyR), daily: N(calc.dailyR), monthly: N(calc.revenueNeeded), net: N(S.takeHome), exp: N(calc.expensesMonthly), tax: S.taxPct, hours: N(calc.monthlyHours, 1), cur: cur() })); };
  $('copyQuote').onclick = function () { copy(quoteText()); };
  $('printQuote').onclick = function () { window.print(); };
  $('saveQuote').onclick = function () {
    var r = qvals(); if (!(r.total > 0)) return;
    S.quotes.unshift({ id: Date.now(), at: new Date().toISOString(), cur: S.currency, q: JSON.parse(JSON.stringify(S.q)), total: r.total }); renderSaved(); save(); toast(T('saved'));
  };
  $('savedList').onclick = function (ev) {
    var b = ev.target.closest && ev.target.closest('button'); if (!b) return; var id = +b.dataset.id;
    if (b.dataset.act === 'del') { if (confirm(T('confirmDel'))) { S.quotes = S.quotes.filter(function (x) { return x.id !== id; }); renderSaved(); save(); } }
    if (b.dataset.act === 'open') { var it = S.quotes.filter(function (x) { return x.id === id; })[0]; if (it) { S.q = merge(JSON.parse(JSON.stringify(DEF.q)), it.q); S.currency = it.cur; syncInputs(); showTab('quote'); } }
  };
  $('exportBtn').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })); a.download = 'ta3rifa-backup.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 500); };
  $('importFile').onchange = function () {
    var f = this.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { try { var o = JSON.parse(rd.result); if (!o || typeof o !== 'object' || !Array.isArray(o.expenses)) throw 0; S = merge(JSON.parse(JSON.stringify(DEF)), o); syncInputs(); toast(T('imported')); } catch (e) { toast(T('badFile')); } };
    rd.readAsText(f); this.value = '';
  };
  $('resetBtn').onclick = function () { if (confirm(T('confirmReset'))) { localStorage.removeItem(KEY); S = load(); syncInputs(); } };
  renderExpenses(); renderSaved(); render();
  var h = location.hash.replace('#', ''); if (['rate', 'quote', 'saved'].indexOf(h) >= 0) showTab(h);
}
function syncInputs() {
  ['takeHome', 'hoursPerWeek', 'weeksOff', 'nonBillablePct', 'hoursPerDay', 'taxPct', 'feePct', 'marginPct'].forEach(function (k) { $(k).value = S[k]; });
  [['qHours', 'hours'], ['qRate', 'rate'], ['qRev', 'rev'], ['qRush', 'rush'], ['qFixed', 'fixed'], ['qDisc', 'disc'], ['qBudget', 'budget'], ['qClient', 'client'], ['qProject', 'project']].forEach(function (a) { $(a[0]).value = S.q[a[1]]; });
  $('deductible').checked = !!S.deductible; $('roundTo').value = String(S.roundTo);
  applyLang(); renderExpenses(); renderSaved(); render();
}
function showTab(t) {
  $$('.tab').forEach(function (e) { e.hidden = e.id !== 'tab-' + t; });
  $$('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); });
  document.body.dataset.tab = t; window.scrollTo(0, 0);
}
function quoteText() {
  var q = S.q, r = qvals(), L = [];
  L.push((q.client ? q.client + ' · ' : '') + (q.project || T('qReceipt')));
  L.push(T('l_base') + ': ' + N(q.hours, 1) + T('hh') + ' × ' + N(q.rate, 1) + ' = ' + money(r.base));
  if (r.revisions) L.push(T('l_rev') + ': ' + money(r.revisions)); if (r.rush) L.push(T('l_rush') + ': ' + money(r.rush)); if (r.fixed) L.push(T('l_fixed') + ': ' + money(r.fixed)); if (r.discount) L.push(T('l_disc') + ': −' + money(r.discount));
  L.push(T('total') + ': ' + money(r.total)); return L.join('\n');
}
function copy(text) {
  var done = function () { toast(T('copied')); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); }
  window.__lastCopy = text;
}
function renderSaved() {
  $('savedEmpty').hidden = S.quotes.length > 0;
  $('savedList').innerHTML = S.quotes.map(function (x) {
    var c = window.CURRENCIES[x.cur] ? window.CURRENCIES[x.cur][S.lang] : x.cur;
    return '<li><div><b>' + esc(x.q.client || T('noClient')) + '</b><span>' + esc(x.q.project || '') + '</span><small>' + new Date(x.at).toLocaleDateString(S.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB') + '</small></div><strong>' + N(x.total) + ' ' + c + '</strong><button class="btn alt sm" data-act="open" data-id="' + x.id + '">' + T('open') + '</button><button class="btn danger sm" data-act="del" data-id="' + x.id + '">' + T('del') + '</button></li>';
  }).join('');
}
document.body.dataset.tab = 'rate';
init();
if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { $('mini').style.visibility = en[0].isIntersecting ? 'hidden' : 'visible'; }).observe($('tag'));
})();

;if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
