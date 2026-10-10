// Home: today's calories, remaining allowance, macros and entries.
import * as N from '../nutrition.js';
import { esc, fmt0, kj, icon, prettyDate } from '../ui.js';
import { openLogSheet, openExerciseSheet, groupedLogRows, wireEntries } from './log.js';
import { fitsCard, wireFitsCard, fastingCard, wireFastingCard } from './today-cards.js';
import { wrappedBanner, wireWrappedBanner } from './wrapped-view.js';
import { openMealSheet, openDrinkSheet } from './meal.js';
import { streakStrip, wireStreakStrip } from './awards-view.js';

export function render(el, app) {
  const today = N.dateStr();
  const day = N.dayTotals(app.data.logs, today);
  const target = N.dailyTarget(app.data.settings);
  const entries = day.entries;

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${esc(prettyDate(today))}</p><h1>Today</h1></div>
      <a class="icon-btn" href="#profile" aria-label="Profile and goals">${icon.gear}</a>
    </header>
    ${target.kcal ? hero(day, target) : setupCard(day)}
    ${streakStrip(app)}
    <div class="actions">
      <button class="btn" id="log-food">${icon.plus} Food or drink</button>
      <button class="btn" id="log-meal">${icon.plus} Meal</button>
      <button class="btn" id="log-drink">${icon.plus} Drink</button>
      <button class="btn secondary" id="log-ex">${icon.flame} Exercise</button>
    </div>
    ${wrappedBanner(app)}
    ${fitsCard(app, day, target)}
    ${fastingCard(app)}
    <section class="card glass">
      <h2>Macros</h2>
      ${macroBar('Protein', 'protein', day.eaten.protein, target.macros?.protein)}
      ${macroBar('Carbs', 'carbs', day.eaten.carbs, target.macros?.carbs)}
      ${macroBar('Fat', 'fat', day.eaten.fat, target.macros?.fat)}
    </section>
    <section class="card glass">
      <h2>Today’s entries</h2>
      ${entries.length ? groupedLogRows(entries)
        : '<div class="empty"><p>Nothing logged yet today.</p></div>'}
    </section>`;

  el.querySelector('#log-food').onclick = () => openLogSheet(app);
  el.querySelector('#log-meal').onclick = () => openMealSheet(app);
  el.querySelector('#log-drink').onclick = () => openDrinkSheet(app);
  el.querySelector('#log-ex').onclick = () => openExerciseSheet(app);
  wireEntries(el, app);
  wireStreakStrip(el, app);
  wireFitsCard(el, app, day, target);
  wireFastingCard(el, app);
  wireWrappedBanner(el, app);

  // Animate the ring from empty.
  const ring = el.querySelector('.ring .value');
  if (ring) {
    const to = ring.getAttribute('data-offset');
    requestAnimationFrame(() => requestAnimationFrame(() => ring.setAttribute('stroke-dashoffset', to)));
  }
}

function hero(day, target) {
  const allowance = target.kcal + (target.addExercise ? day.burned : 0);
  const left = N.remainingKcal(target, day);
  const over = left < 0;
  const r = 51;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, allowance ? day.eaten.kcal / allowance : 0);
  // Today's calories on a dinner plate: the rim fills up as you eat.
  return `
    <section class="card glass placemat">
      <div class="hero">
        <div class="ring plate ${over ? 'over' : ''}">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="plate-base" cx="60" cy="60" r="59"/>
            <circle class="track" cx="60" cy="60" r="${r}"/>
            <circle class="plate-well" cx="60" cy="60" r="42"/>
            <circle class="value" cx="60" cy="60" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-offset="${c * (1 - pct)}"/>
          </svg>
          <div class="ring-label"><strong class="num">${fmt0(Math.abs(left))}</strong><span>${over ? 'kcal over' : 'kcal left'}</span></div>
        </div>
        <div class="stats">
          <div class="stat"><span class="muted">Eaten</span><b class="num">${fmt0(day.eaten.kcal)} kcal</b></div>
          <div class="stat"><span class="muted">Target</span><b class="num">${fmt0(target.kcal)} kcal</b></div>
          ${day.burned ? `<div class="stat"><span class="muted">Exercise</span><b class="num">${target.addExercise ? '+' : ''}${fmt0(day.burned)} kcal</b></div>` : ''}
          <div class="stat"><span class="muted">${over ? 'Over' : 'Left'}</span><b class="num">${kj(Math.abs(left))}</b></div>
        </div>
      </div>
    </section>`;
}

function setupCard(day) {
  return `
    <section class="card glass">
      <div class="row"><div class="grow">
        <div style="font-size:34px;font-weight:750;letter-spacing:-.02em" class="num">${fmt0(day.eaten.kcal)} kcal</div>
        <div class="muted small num">eaten today · ${kj(day.eaten.kcal)}</div>
      </div></div>
      <p class="small muted">Set up your profile and goal to get a recommended daily target.</p>
      <a class="btn block secondary" href="#profile">Set up profile & goal</a>
    </section>`;
}

function macroBar(label, cls, value, goal) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return `<div class="macro">
    <div class="macro-top"><span>${label}</span><span class="num muted">${fmt0(value)}${goal ? ` / ${fmt0(goal)}` : ''} g</span></div>
    <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
  </div>`;
}
