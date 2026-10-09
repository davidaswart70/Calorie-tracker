// Reports: daily and weekly intake, biggest calorie sources, weight tracking.
import * as N from '../nutrition.js';
import { esc, fmt0, fmt1, kcal, kj, macroLine, prettyDate, icon, seg, wireSegs, saving } from '../ui.js';
import { logRow, wireDeletes, openLogSheet } from './log.js';

export function render(el, app) {
  const today = N.dateStr();
  const st = (app.state.reports ??= { tab: 'week', day: today, weekEnd: today });

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Your progress</p><h1>Reports</h1></div></header>
    <div style="margin-bottom:14px">${seg('tab', [['day', 'Day'], ['week', 'Week'], ['weight', 'Weight']], st.tab)}</div>
    <div id="tab"></div>`;
  wireSegs(el, (_, v) => { st.tab = v; draw(); });

  const box = el.querySelector('#tab');
  const draw = () => {
    box.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'screen';
    box.append(inner);
    ({ day: dayTab, week: weekTab, weight: weightTab })[st.tab](inner, app, st);
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

// ---------- Day ----------

function dayTab(el, app, st) {
  const today = N.dateStr();
  const day = N.dayTotals(app.data.logs, st.day);
  const target = N.dailyTarget(app.data.settings);
  const entries = [...day.entries].sort((a, b) => (a.time < b.time ? -1 : 1));
  const left = target.kcal ? N.remainingKcal(target, day) : null;

  el.innerHTML = `
    <section class="card glass">
      ${dateNav(st.day === today ? 'Today' : prettyDate(st.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), st.day < today)}
      <div class="grid-2">
        <div><div class="small muted">Eaten</div><div class="big num" style="font-size:26px;font-weight:750">${kcal(day.eaten.kcal)}</div><div class="small muted num">${kj(day.eaten.kcal)}</div></div>
        <div><div class="small muted">${left === null ? 'Target' : left < 0 ? 'Over target' : 'Under target'}</div>
          <div class="big num" style="font-size:26px;font-weight:750">${left === null ? '—' : kcal(Math.abs(left))}</div>
          <div class="small muted num">${target.kcal ? `of ${kcal(target.kcal)}` : 'Set a goal in your profile'}</div></div>
      </div>
      <div class="small num" style="margin-top:10px">${macroLine(day.eaten)}${day.burned ? ` · Exercise ${kcal(day.burned)}` : ''}</div>
    </section>
    <section class="card glass">
      <div class="card-head"><h2>Entries</h2><button class="btn secondary small" id="add">${icon.plus} Add</button></div>
      ${entries.length ? `<ul class="list">${entries.map(logRow).join('')}</ul>` : '<div class="empty"><p>Nothing logged on this day.</p></div>'}
    </section>`;

  el.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => {
    const next = N.addDays(st.day, Number(b.dataset.nav));
    if (next <= today) { st.day = next; app.render(); }
  }));
  el.querySelector('#add').onclick = () => openLogSheet(app, null, st.day);
  wireDeletes(el, app);
}

// ---------- Week ----------

function weekTab(el, app, st) {
  const today = N.dateStr();
  const week = N.weeklyReport(app.data.logs, st.weekEnd);
  const target = N.dailyTarget(app.data.settings);
  const top = N.topSources(app.data.logs, week.start, week.end, 5);
  const label = `${prettyDate(week.start, { day: 'numeric', month: 'short' })} – ${prettyDate(week.end, { day: 'numeric', month: 'short' })}`;
  const diff = target.kcal && week.daysLogged ? week.average.kcal - target.kcal : null;

  el.innerHTML = `
    <section class="card glass">
      ${dateNav(label, st.weekEnd < today)}
      <h2 style="margin-bottom:4px">Calories per day</h2>
      <div class="chart" id="week-chart"></div>
    </section>
    <section class="card glass">
      <h2>Summary</h2>
      ${week.daysLogged ? `
      <div class="grid-2">
        <div><div class="small muted">Average per day</div><b class="num" style="font-size:22px">${kcal(week.average.kcal)}</b><div class="small muted num">${kj(week.average.kcal)}</div></div>
        <div><div class="small muted">Compared with target</div><b class="num" style="font-size:22px">${diff === null ? '—' : `${fmt0(Math.abs(diff))} kcal`}</b>
          <div class="small muted">${diff === null ? 'No target set' : diff > 0 ? 'over target per day' : 'under target per day'}</div></div>
      </div>
      <div class="small num" style="margin-top:10px">Average macros: ${macroLine(week.average)}</div>
      <div class="small muted num" style="margin-top:4px">${week.daysLogged} of 7 days logged · ${kcal(week.total.kcal)} in total${week.burned ? ` · ${kcal(week.burned)} exercise` : ''}</div>
      <table class="table num" style="margin-top:12px">
        <tr><th>Day</th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr>
        ${week.days.map((d) => `<tr><td>${esc(prettyDate(d.date, { weekday: 'short', day: 'numeric' }))}</td>
          <td>${d.entries.length ? fmt0(d.eaten.kcal) : '—'}</td><td>${fmt0(d.eaten.protein)}</td><td>${fmt0(d.eaten.carbs)}</td><td>${fmt0(d.eaten.fat)}</td></tr>`).join('')}
      </table>` : '<div class="empty"><p>No food logged this week.</p></div>'}
    </section>
    <section class="card glass">
      <h2>Where your calories came from</h2>
      ${top.length ? `<ul class="list">${top.map((t) => `<li style="display:block">
          <div class="row"><div class="grow"><div class="title">${esc(t.name)}</div><div class="sub">${t.count} time${t.count === 1 ? '' : 's'} this week</div></div>
          <div class="value num">${kcal(t.kcal)}<small>${fmt0(t.share * 100)} % of the week</small></div></div>
          <div class="share-bar"><i style="width:${(t.share * 100).toFixed(1)}%"></i></div></li>`).join('')}</ul>
        <p class="tiny" style="margin:10px 0 0">Your biggest calorie sources this week. Cutting back on the top items saves the most.</p>`
        : '<div class="empty"><p>Nothing logged yet.</p></div>'}
    </section>`;

  el.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => {
    const next = N.addDays(st.weekEnd, 7 * Number(b.dataset.nav));
    st.weekEnd = next > today ? today : next;
    app.render();
  }));
  barChart(el.querySelector('#week-chart'), week.days, target.kcal);
}

function barChart(el, days, targetKcal) {
  const W = 340, H = 190, padL = 36, padR = 8, padT = 14, padB = 24;
  const max = Math.max(targetKcal || 0, ...days.map((d) => d.eaten.kcal), 500) * 1.12;
  const step = niceStep(max);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const slot = (W - padL - padR) / days.length;
  const bw = Math.min(26, slot * 0.55);

  let grid = '';
  for (let v = 0; v <= max; v += step) {
    grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis-label" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v >= 1000 ? `${fmt1(v / 1000)}k` : v}</text>`;
  }
  const bars = days.map((d, i) => {
    const cx = padL + slot * i + slot / 2;
    const v = d.eaten.kcal;
    const top = y(v), base = y(0), r = Math.min(4, (base - top) / 2);
    const path = v > 0
      ? `<path class="bar" data-i="${i}" d="M${cx - bw / 2},${base} V${top + r} q0,-${r} ${r},-${r} H${cx + bw / 2 - r} q${r},0 ${r},${r} V${base} Z"/>`
      : '';
    return `${path}
      <text class="axis-label" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(prettyDate(d.date, { weekday: 'narrow' }))}</text>
      <rect class="hit" data-i="${i}" x="${cx - slot / 2}" y="${padT}" width="${slot}" height="${H - padT - padB}"/>`;
  }).join('');
  const tline = targetKcal ? `<line class="target" x1="${padL}" x2="${W - padR}" y1="${y(targetKcal)}" y2="${y(targetKcal)}"/>
      <text class="target-label" x="${W - padR}" y="${y(targetKcal) - 5}" text-anchor="end">Target ${fmt0(targetKcal)}</text>` : '';

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories eaten per day this week">${grid}${tline}${bars}</svg><div class="tip hidden"></div>`;

  const tip = el.querySelector('.tip');
  const show = (i) => {
    const d = days[i];
    el.querySelectorAll('.bar').forEach((b) => b.classList.toggle('dim', b.dataset.i !== String(i)));
    tip.innerHTML = `<b>${esc(prettyDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</b><br>${kcal(d.eaten.kcal)} · ${kj(d.eaten.kcal)}`;
    const rect = el.getBoundingClientRect();
    const x = ((padL + slot * i + slot / 2) / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(x, 70), rect.width - 70)}px`;
    tip.style.top = `${Math.max(0, (y(d.eaten.kcal) / H) * rect.height - 52)}px`;
    tip.classList.remove('hidden');
  };
  const hide = () => { tip.classList.add('hidden'); el.querySelectorAll('.bar').forEach((b) => b.classList.remove('dim')); };
  el.querySelectorAll('.hit').forEach((h) => {
    h.addEventListener('pointerenter', () => show(h.dataset.i));
    h.addEventListener('click', () => show(h.dataset.i));
  });
  el.querySelector('svg').addEventListener('pointerleave', hide);
}

function niceStep(max) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
}

// ---------- Weight ----------

function weightTab(el, app) {
  const today = N.dateStr();
  const weights = [...app.data.weights].filter((w) => N.num(w.weightKg) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const change = latest && first && latest !== first ? N.num(latest.weightKg) - N.num(first.weightKg) : null;

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
        <div class="grid-2" style="margin-bottom:10px">
          <div><div class="small muted">Latest</div><b class="num" style="font-size:22px">${fmt1(latest.weightKg)} kg</b></div>
          <div><div class="small muted">Change since ${esc(prettyDate(first.date, { day: 'numeric', month: 'short' }))}</div>
            <b class="num" style="font-size:22px">${change === null ? '—' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${fmt1(Math.abs(change))} kg`}</b></div>
        </div>
        ${weights.length > 1 ? '<div class="chart" id="weight-chart"></div>' : '<p class="small muted">Log at least two weights to see a trend.</p>'}`
        : '<div class="empty"><p>No weights logged yet.</p></div>'}
    </section>
    ${weights.length ? `<section class="card glass"><h2>History</h2><ul class="list">${[...weights].reverse().map((w) => `
      <li><div class="grow"><div class="title">${esc(prettyDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
        <div class="value num">${fmt1(w.weightKg)} kg</div>
        <button class="icon-btn plain" data-delw="${esc(w.id)}" aria-label="Delete">${icon.trash}</button></li>`).join('')}</ul></section>` : ''}`;

  el.querySelector('#save').onclick = async (e) => {
    const kg = N.num(el.querySelector('#kg').value);
    const date = el.querySelector('#date').value || today;
    if (kg <= 0) return el.querySelector('#kg').focus();
    const res = await saving(e.currentTarget, async () => {
      await app.store.saveWeight(date, kg);
      // Keep the profile weight (used for the calorie target) up to date with the newest entry.
      if (!latest || date >= latest.date) await app.store.saveSettings({ weightKg: kg });
    }, `Saved ${fmt1(kg)} kg`);
    if (res.ok) app.refresh();
  };
  el.querySelectorAll('[data-delw]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this weight entry?')) return;
    const res = await saving(null, () => app.store.remove('weights', b.dataset.delw), 'Weight entry deleted');
    if (res.ok) app.refresh();
  }));

  if (weights.length > 1) lineChart(el.querySelector('#weight-chart'), weights);
}

function lineChart(el, weights) {
  const W = 340, H = 180, padL = 36, padR = 12, padT = 12, padB = 24;
  const t = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).getTime(); };
  const xs = weights.map((w) => t(w.date));
  const vs = weights.map((w) => N.num(w.weightKg));
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const lo = Math.floor(Math.min(...vs) - 1), hi = Math.ceil(Math.max(...vs) + 1);
  const x = (v) => padL + ((v - x0) / (x1 - x0 || 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const step = Math.max(1, Math.ceil((hi - lo) / 4));

  let grid = '';
  for (let v = lo; v <= hi; v += step) {
    grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  const pts = weights.map((w, i) => [x(xs[i]), y(vs[i])]);
  const axis = `<text class="axis-label" x="${padL}" y="${H - 6}">${esc(prettyDate(weights[0].date, { day: 'numeric', month: 'short' }))}</text>
    <text class="axis-label" x="${W - padR}" y="${H - 6}" text-anchor="end">${esc(prettyDate(weights[weights.length - 1].date, { day: 'numeric', month: 'short' }))}</text>`;
  const dots = weights.length <= 40 ? pts.map(([px, py]) => `<circle class="dot" cx="${px}" cy="${py}" r="4"/>`).join('') : '';

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time">${grid}${axis}
    <polyline class="line" points="${pts.map((p) => p.join(',')).join(' ')}"/>${dots}
    <line class="cross hidden" y1="${padT}" y2="${H - padB}"/>
    <rect class="hit" x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}"/></svg><div class="tip hidden"></div>`;

  const svg = el.querySelector('svg');
  const tip = el.querySelector('.tip');
  const cross = el.querySelector('.cross');
  const move = (e) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p[0] - vx) < Math.abs(pts[best][0] - vx)) best = i; });
    const [px, py] = pts[best];
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.classList.remove('hidden');
    tip.innerHTML = `<b>${fmt1(vs[best])} kg</b><br>${esc(prettyDate(weights[best].date, { day: 'numeric', month: 'short', year: 'numeric' }))}`;
    tip.style.left = `${Math.min(Math.max((px / W) * rect.width, 60), rect.width - 60)}px`;
    tip.style.top = `${Math.max(0, (py / H) * rect.height - 52)}px`;
    tip.classList.remove('hidden');
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => { tip.classList.add('hidden'); cross.classList.add('hidden'); });
}
