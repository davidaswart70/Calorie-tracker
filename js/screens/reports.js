// Reports: day, week and month views with animated charts, plus weight tracking.
import * as N from '../nutrition.js';
import { esc, fmt0, fmt1, kcal, kj, prettyDate, icon, seg, wireSegs, saveInBackground } from '../ui.js';
import { ring, donut, bars, line, legend, animate } from '../charts.js';
import { logRow, wireDeletes, openLogSheet } from './log.js';
import { openMealSheet } from './meal.js';
import { awardsTab } from './awards-view.js';
import { maintenanceCard, wireMaintenanceCard } from './maintenance.js';

const MACROS = [
  { key: 'protein', label: 'Protein', cls: 'protein' },
  { key: 'carbs', label: 'Carbs', cls: 'carbs' },
  { key: 'fat', label: 'Fat', cls: 'fat' },
];

export function render(el, app) {
  const today = N.dateStr();
  const st = (app.state.reports ??= { tab: 'week', day: today, end: today, macro: 'protein' });
  st.end ??= today;
  st.day ??= today;

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Your progress</p><h1>Reports</h1></div></header>
    <div style="margin-bottom:14px">${seg('tab', [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['weight', 'Weight'], ['awards', 'Awards']], st.tab)}</div>
    <div id="tab"></div>`;
  wireSegs(el.querySelector('.page-head').nextElementSibling, (_, v) => { st.tab = v; draw(); });

  const box = el.querySelector('#tab');
  const draw = () => {
    box.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'screen';
    box.append(inner);
    if (st.tab === 'day') dayTab(inner, app, st);
    else if (st.tab === 'week') periodTab(inner, app, st, 7);
    else if (st.tab === 'month') periodTab(inner, app, st, 30);
    else if (st.tab === 'awards') awardsTab(inner, app);
    else weightTab(inner, app);
    animate(inner);
  };
  draw();
}

function dateNav(label, canNext) {
  return `<div class="date-nav">
    <button class="icon-btn" data-nav="-1" aria-label="Previous">${icon.left}</button>
    <b>${esc(label)}</b>
    <button class="icon-btn" data-nav="1" aria-label="Next" ${canNext ? '' : 'disabled style="opacity:.35"'}>${icon.right}</button>
  </div>`;
}

const pct = (v) => `${fmt0(v * 100)}%`;
const signed = (v, unit) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt0(Math.abs(v))}${unit}`;

/** Donut + legend showing where calories came from. */
function energySplit(totals) {
  const e = N.macroEnergy(totals);
  if (!e.total) return '<div class="empty"><p>No macros logged.</p></div>';
  return `<div class="split">
    ${donut({ parts: MACROS.map((m) => ({ value: e[m.key], cls: m.cls })), center: `<strong class="num">${fmt0(e.total)}</strong><span>kcal from macros</span>` })}
    <ul class="split-legend">${MACROS.map((m) => `
      <li><i class="swatch ${m.cls}"></i><div class="grow"><b>${m.label}</b><div class="small muted num">${fmt1(totals[m.key])} g · ${fmt0(e[m.key])} kcal</div></div>
        <b class="num">${pct(e.shares[m.key])}</b></li>`).join('')}</ul>
  </div>`;
}

// ---------- Day ----------

function dayTab(el, app, st) {
  const today = N.dateStr();
  const day = N.dayTotals(app.data.logs, st.day);
  const target = N.dailyTarget(app.data.settings);
  const entries = [...day.entries].sort((a, b) => (a.time < b.time ? -1 : 1));
  const allowance = target.kcal + (target.addExercise ? day.burned : 0);
  const left = target.kcal ? allowance - day.eaten.kcal : null;
  const timeline = N.cumulativeByTime(day.entries);

  el.innerHTML = `
    <section class="card glass">
      ${dateNav(st.day === today ? 'Today' : prettyDate(st.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), st.day < today)}
      <div class="day-hero">
        ${ring({ value: day.eaten.kcal, max: allowance || day.eaten.kcal || 1, cls: 'kcal', size: 150, stroke: 14, over: left !== null && left < 0,
          center: `<strong class="num">${fmt0(day.eaten.kcal)}</strong><span>${target.kcal ? `of ${fmt0(allowance)} kcal` : 'kcal'}</span>` })}
        <div class="stats">
          <div class="stat"><span class="muted">Eaten</span><b class="num">${kj(day.eaten.kcal)}</b></div>
          <div class="stat"><span class="muted">${left === null ? 'Target' : left < 0 ? 'Over' : 'Left'}</span><b class="num">${left === null ? '—' : kcal(Math.abs(left))}</b></div>
          ${day.burned ? `<div class="stat"><span class="muted">Exercise</span><b class="num">${kcal(day.burned)}</b></div>` : ''}
        </div>
      </div>
      <div class="macro-rings">${MACROS.map((m) => {
        const goal = target.macros?.[m.key] || 0;
        return `<div>${ring({ value: day.eaten[m.key], max: goal || day.eaten[m.key] || 1, cls: m.cls, size: 84, stroke: 9,
          center: `<strong class="num">${fmt0(day.eaten[m.key])}</strong><span>g</span>` })}
          <b>${m.label}</b><span class="small muted num">${goal ? `of ${fmt0(goal)} g` : '—'}</span></div>`;
      }).join('')}</div>
    </section>

    <section class="card glass">
      <h2>Where your calories came from</h2>
      ${energySplit(day.eaten)}
    </section>

    <section class="card glass">
      <h2>Through the day</h2>
      ${timeline.length ? '<div class="chart" id="timeline"></div>' : '<div class="empty"><p>Nothing logged on this day.</p></div>'}
    </section>

    <section class="card glass">
      <div class="card-head"><h2>Entries</h2>
        <div class="row"><button class="btn secondary small" id="add">${icon.plus} Item</button><button class="btn secondary small" id="add-meal">${icon.plus} Meal</button></div></div>
      ${entries.length ? `<ul class="list">${entries.map(logRow).join('')}</ul>` : '<div class="empty"><p>Nothing logged on this day.</p></div>'}
    </section>`;

  if (timeline.length) {
    const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    line(el.querySelector('#timeline'), {
      points: timeline.map((p) => ({ x: p.minutes, y: p.kcal })),
      xDomain: [0, 24 * 60],
      xTicks: [0, 6, 12, 18, 24].map((h) => ({ x: h * 60, label: `${String(h).padStart(2, '0')}:00` })),
      yMin: 0, target: allowance, targetLabel: 'Target', step: true, area: true,
      tip: (i) => `<b>${esc(timeline[i].name)}</b><br>${hhmm(timeline[i].minutes)} · ${kcal(timeline[i].kcal)} so far`,
    });
  }

  el.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => {
    const next = N.addDays(st.day, Number(b.dataset.nav));
    if (next <= today) { st.day = next; app.render(); }
  }));
  el.querySelector('#add').onclick = () => openLogSheet(app, null, st.day);
  el.querySelector('#add-meal').onclick = () => openMealSheet(app, st.day);
  wireDeletes(el, app);
}

// ---------- Week / Month ----------

function periodTab(el, app, st, length) {
  const today = N.dateStr();
  const rep = N.periodReport(app.data.logs, st.end, length);
  const target = N.dailyTarget(app.data.settings);
  const top = N.topSources(app.data.logs, rep.start, rep.end, 5);
  const logged = rep.days.filter((d) => d.entries.some((e) => e.type !== 'exercise'));
  const onTarget = target.kcal ? logged.filter((d) => d.eaten.kcal <= target.kcal + (target.addExercise ? d.burned : 0)).length : null;
  const proteinGoal = target.macros?.protein || 0;
  const proteinHit = proteinGoal ? logged.filter((d) => d.eaten.protein >= proteinGoal * 0.9).length : null;
  const range = `${prettyDate(rep.start, { day: 'numeric', month: 'short' })} – ${prettyDate(rep.end, { day: 'numeric', month: 'short' })}`;
  const dayLabel = (d, i) => (length <= 7
    ? prettyDate(d.date, { weekday: 'narrow' })
    : i % 5 === 4 || i === 0 ? prettyDate(d.date, { day: 'numeric' }) : '');
  const tipDate = (d) => esc(prettyDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }));
  const macro = MACROS.find((m) => m.key === st.macro) || MACROS[0];

  el.innerHTML = `
    <section class="card glass">
      ${dateNav(range, st.end < today)}
      ${logged.length ? `<div class="tiles">
        <div class="tile"><span>Average a day</span><b class="num">${fmt0(rep.average.kcal)}</b><small class="num">kcal${target.kcal ? ` · ${signed(rep.average.kcal - target.kcal, '')} vs target` : ''}</small></div>
        <div class="tile"><span>Days on target</span><b class="num">${onTarget === null ? '—' : `${onTarget}/${logged.length}`}</b><small>${onTarget === null ? 'No target set' : 'at or under target'}</small></div>
        <div class="tile"><span>Average protein</span><b class="num">${fmt0(rep.average.protein)} g</b><small class="num">${proteinGoal ? `goal ${fmt0(proteinGoal)} g · hit ${proteinHit}/${logged.length} days` : 'a day'}</small></div>
        <div class="tile"><span>Logged</span><b class="num">${logged.length}/${length}</b><small class="num">days${rep.burned ? ` · ${fmt0(rep.burned)} kcal exercise` : ''}</small></div>
      </div>` : '<div class="empty"><p>Nothing logged in this period.</p></div>'}
    </section>

    ${logged.length ? `
    <section class="card glass">
      <h2>Calories per day</h2>
      <div class="chart" id="kcal-chart"></div>
    </section>

    <section class="card glass">
      <h2>Macros per day</h2>
      <p class="small muted" style="margin:-6px 0 6px">Calories from protein, carbs and fat</p>
      ${legend(MACROS.map((m) => ({ cls: m.cls, label: m.label })))}
      <div class="chart" id="stack-chart"></div>
    </section>

    <section class="card glass">
      <div class="card-head"><h2>${macro.label} per day</h2></div>
      <div style="margin-bottom:10px">${seg('macro', MACROS.map((m) => [m.key, m.label]), macro.key)}</div>
      <div class="chart" id="macro-chart"></div>
    </section>

    <section class="card glass">
      <h2>Average calorie split</h2>
      ${energySplit(rep.average)}
    </section>

    <section class="card glass">
      <h2>Where your calories came from</h2>
      <ul class="list">${top.map((t) => `<li style="display:block">
          <div class="row"><div class="grow"><div class="title">${esc(t.name)}</div><div class="sub">${t.count} time${t.count === 1 ? '' : 's'}</div></div>
          <div class="value num">${kcal(t.kcal)}<small>${fmt0(t.share * 100)}% of the period</small></div></div>
          <div class="share-bar anim"><i style="--w:${(t.share * 100).toFixed(1)}%"></i></div></li>`).join('')}</ul>
      <p class="tiny" style="margin:10px 0 0">Cutting back on the top items saves the most calories.</p>
    </section>

    <section class="card glass">
      <h2>Day by day</h2>
      ${length > 7 ? '<details class="maths"><summary>Show all days</summary>' : ''}
      <table class="table num">
        <tr><th>Day</th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr>
        ${[...rep.days].reverse().map((d) => `<tr><td>${esc(prettyDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</td>
          <td>${d.entries.some((e) => e.type !== 'exercise') ? fmt0(d.eaten.kcal) : '—'}</td><td>${fmt0(d.eaten.protein)}</td><td>${fmt0(d.eaten.carbs)}</td><td>${fmt0(d.eaten.fat)}</td></tr>`).join('')}
      </table>
      ${length > 7 ? '</details>' : ''}
    </section>` : ''}`;

  el.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => {
    const next = N.addDays(st.end, length * Number(b.dataset.nav));
    st.end = next > today ? today : next;
    app.render();
  }));
  if (!logged.length) return;

  const labels = rep.days.map(dayLabel);
  bars(el.querySelector('#kcal-chart'), {
    labels, series: [{ cls: 'kcal', values: rep.days.map((d) => d.eaten.kcal) }],
    target: target.kcal, targetLabel: 'Target',
    tip: (i) => `<b>${tipDate(rep.days[i])}</b><br>${kcal(rep.days[i].eaten.kcal)} · ${kj(rep.days[i].eaten.kcal)}`,
  });

  bars(el.querySelector('#stack-chart'), {
    labels,
    series: MACROS.map((m) => ({ cls: m.cls, values: rep.days.map((d) => N.macroEnergy(d.eaten)[m.key]) })),
    tip: (i) => {
      const d = rep.days[i].eaten;
      const e = N.macroEnergy(d);
      return `<b>${tipDate(rep.days[i])}</b>${MACROS.map((m) => `<br><i class="swatch ${m.cls}"></i> ${m.label} ${fmt0(d[m.key])} g · ${pct(e.shares[m.key])}`).join('')}`;
    },
  });

  const drawMacro = (m) => {
    const goal = target.macros?.[m.key] || 0;
    el.querySelector('#macro-chart').closest('.card').querySelector('h2').textContent = `${m.label} per day`;
    bars(el.querySelector('#macro-chart'), {
      labels, series: [{ cls: m.cls, values: rep.days.map((d) => d.eaten[m.key]) }],
      target: goal, targetLabel: 'Goal', unit: ' g',
      tip: (i) => `<b>${tipDate(rep.days[i])}</b><br>${fmt1(rep.days[i].eaten[m.key])} g ${m.label.toLowerCase()}${goal ? ` · goal ${fmt0(goal)} g` : ''}`,
    });
    animate(el.querySelector('#macro-chart'));
  };
  wireSegs(el.querySelector('#macro-chart').closest('.card'), (_, key) => {
    st.macro = key;
    drawMacro(MACROS.find((m) => m.key === key));
  });
  drawMacro(macro);
}

// ---------- Weight ----------

function weightTab(el, app) {
  const today = N.dateStr();
  const weights = [...app.data.weights].filter((w) => N.num(w.weightKg) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const change = latest && first && latest !== first ? N.num(latest.weightKg) - N.num(first.weightKg) : null;
  const rate = N.weightRate(weights);
  const goal = N.GOALS.find((g) => g.id === app.data.settings.goal);

  el.innerHTML = `
    <section class="card glass stack">
      <h2>Log your weight</h2>
      <div class="grid-2">
        <label class="field"><span>Weight (kg)</span><input class="input num" id="kg" inputmode="decimal" placeholder="${latest ? fmt1(latest.weightKg) : 'e.g. 82.5'}"></label>
        <label class="field"><span>Date</span><input class="input" id="date" type="date" value="${today}" max="${today}"></label>
      </div>
      <button class="btn block" id="save">Save weight</button>
    </section>
    <section class="card glass">
      <h2>Weight trend</h2>
      ${weights.length ? `
        <div class="tiles">
          <div class="tile"><span>Latest</span><b class="num">${fmt1(latest.weightKg)} kg</b><small>${esc(prettyDate(latest.date, { day: 'numeric', month: 'short' }))}</small></div>
          <div class="tile"><span>Change</span><b class="num">${change === null ? '—' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${fmt1(Math.abs(change))} kg`}</b><small>since ${esc(prettyDate(first.date, { day: 'numeric', month: 'short' }))}</small></div>
          <div class="tile"><span>Trend</span><b class="num">${rate === null ? '—' : `${rate > 0 ? '+' : rate < 0 ? '−' : ''}${fmt1(Math.abs(rate))} kg`}</b><small>per week</small></div>
          <div class="tile"><span>Your goal</span><b class="num">${goal ? (goal.kgPerWeek ? `${goal.kgPerWeek > 0 ? '+' : '−'}${Math.abs(goal.kgPerWeek)} kg` : 'Maintain') : '—'}</b><small>${goal ? (goal.kgPerWeek ? 'per week' : 'keep steady') : 'Set in profile'}</small></div>
        </div>
        ${weights.length > 1 ? '<div class="chart" id="weight-chart" style="margin-top:12px"></div>' : '<p class="small muted">Log at least two weights to see a trend.</p>'}`
        : '<div class="empty"><p>No weights logged yet.</p></div>'}
    </section>
    ${maintenanceCard(app)}
    ${weights.length ? `<section class="card glass"><h2>History</h2><ul class="list">${[...weights].reverse().map((w) => `
      <li><div class="grow"><div class="title">${esc(prettyDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
        <div class="value num">${fmt1(w.weightKg)} kg</div>
        <button class="icon-btn plain" data-delw="${esc(w.id)}" aria-label="Delete">${icon.trash}</button></li>`).join('')}</ul></section>` : ''}`;

  el.querySelector('#save').onclick = () => {
    const kg = N.num(el.querySelector('#kg').value);
    const date = el.querySelector('#date').value || today;
    if (kg <= 0) return el.querySelector('#kg').focus();
    // The newest weight also updates the profile weight (used for the calorie target), in the same request.
    saveInBackground(app,
      () => (!latest || date >= latest.date ? app.store.saveSettings({ weightKg: kg }, { date, weightKg: kg }) : app.store.saveWeight(date, kg)),
      `Saved ${fmt1(kg)} kg`);
  };
  wireMaintenanceCard(el, app);
  el.querySelectorAll('[data-delw]').forEach((b) => (b.onclick = () => {
    if (!confirm('Delete this weight entry?')) return;
    saveInBackground(app, () => app.store.remove('weights', b.dataset.delw), 'Weight entry deleted');
  }));

  if (weights.length > 1) {
    const day = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
    const xs = weights.map((w) => day(w.date));
    line(el.querySelector('#weight-chart'), {
      points: weights.map((w, i) => ({ x: xs[i], y: N.num(w.weightKg) })),
      xDomain: [xs[0], xs[xs.length - 1]], yPad: 1,
      xTicks: [{ x: xs[0], label: prettyDate(first.date, { day: 'numeric', month: 'short' }) }, { x: xs[xs.length - 1], label: prettyDate(latest.date, { day: 'numeric', month: 'short' }) }],
      tip: (i) => `<b>${fmt1(weights[i].weightKg)} kg</b><br>${esc(prettyDate(weights[i].date, { day: 'numeric', month: 'short', year: 'numeric' }))}`,
    });
  }
}
