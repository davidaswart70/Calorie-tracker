// Home cards: "Fits your day" suggestions and the fasting timer.
import * as N from '../nutrition.js';
import { esc, fmt0, fmt1, icon } from '../ui.js';
import { ring, animate } from '../charts.js';
import { openLogSheet } from './log.js';
import { glyph } from '../glyphs.js';

// ---------- What can I still eat? ----------

export function fitsCard(app, day, target) {
  if (!target.kcal) return '';
  const allowance = target.kcal + (target.addExercise ? day.burned : 0);
  const kcalLeft = allowance - day.eaten.kcal;
  const proteinLeft = Math.max(0, (target.macros?.protein || 0) - day.eaten.protein);
  const { fits, free } = N.suggestions(app.data, kcalLeft, proteinLeft);
  const row = (s, i) => `<li class="tap" data-fit="${i}">
      <div class="grow"><div class="title">${esc(s.item.name)}</div>
        <div class="sub num">${s.unit === 'serving' ? '1 serving' : `${fmt0(s.qty)} ${s.unit}`} · ${fmt0(s.n.protein)} g protein</div></div>
      <div class="value num">${fmt0(s.n.kcal)} kcal</div>
      <span class="icon-btn plain" aria-hidden="true">${icon.plus}</span></li>`;

  let body;
  if (kcalLeft < 20) {
    body = `<p class="small muted" style="margin:0 0 8px">You’ve reached today’s target.${free.length ? ' These are practically free:' : ''}</p>
      ${free.length ? `<ul class="list">${free.map((s, i) => row(s, `f${i}`)).join('')}</ul>` : ''}`;
  } else if (!fits.length) {
    body = `<p class="small muted" style="margin:0">Nothing in your Fridge, Bar or Cookbook fits in ${fmt0(kcalLeft)} kcal as a full portion. Try a smaller amount of something.</p>`;
  } else {
    body = `<ul class="list">${fits.map((s, i) => row(s, i)).join('')}</ul>`;
  }
  return `<section class="card glass" id="fits">
    <div class="card-head"><h2>Fits your day</h2>
      <span class="small muted num">${fmt0(Math.max(0, kcalLeft))} kcal${proteinLeft > 0 ? ` · ${fmt0(proteinLeft)} g protein` : ''} left</span></div>
    ${body}
  </section>`;
}

export function wireFitsCard(el, app, day, target) {
  if (!target.kcal) return;
  const allowance = target.kcal + (target.addExercise ? day.burned : 0);
  const { fits, free } = N.suggestions(app.data, allowance - day.eaten.kcal, Math.max(0, (target.macros?.protein || 0) - day.eaten.protein));
  el.querySelectorAll('[data-fit]').forEach((li) => (li.onclick = () => {
    const key = li.dataset.fit;
    const s = key.startsWith('f') ? free[Number(key.slice(1))] : fits[Number(key)];
    openLogSheet(app, { type: s.type, item: s.item });
  }));
}

// ---------- Fasting ----------

let fastTimer = null;

const duration = (min) => `${Math.floor(min / 60)} h ${String(Math.floor(min % 60)).padStart(2, '0')} m`;
const clock = (minuteOfEpoch) => {
  const m = ((minuteOfEpoch % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

function fastingHtml(app) {
  const goal = N.num(app.data.settings.fastingHours);
  const f = N.fastingState(app.data.logs, goal);
  if (f.sinceMin === null) {
    return `<div class="fast-row"><div class="grow"><b>${glyph('⏳')} Fasting timer</b><div class="small muted">Starts after your first logged meal.</div></div></div>`;
  }
  const status = !goal
    ? '<a href="#profile">Set a fasting goal</a>'
    : f.reached ? `Goal of ${goal} h reached ${glyph('🎉')}` : `Goal ${goal} h · eat from ${clock(f.endsAtMin)}${Math.floor(f.endsAtMin / 1440) > Math.floor((f.lastAt + f.sinceMin) / 1440) ? ' tomorrow' : ''}`;
  return `<div class="fast-row">
    ${goal ? ring({ value: f.sinceMin, max: f.goalMin, cls: f.reached ? 'protein' : 'carbs', size: 64, stroke: 7, center: `<strong class="num">${Math.round(f.progress * 100)}%</strong>` }) : ''}
    <div class="grow">
      <div class="small muted">${f.sinceMin < 3 * 60 ? 'Since your last meal' : 'Fasting for'}</div>
      <b class="fast-time num">${duration(f.sinceMin)}</b>
      <div class="small muted">${status}</div>
    </div>
    ${goal ? `<div class="fast-streak"><b class="num">${f.streak.current}</b><small>day streak</small></div>` : ''}
  </div>`;
}

export function fastingCard(app) {
  return `<section class="card glass" id="fasting">${fastingHtml(app)}</section>`;
}

/** Keep the timer ticking while Home is open. */
export function wireFastingCard(el, app) {
  clearInterval(fastTimer);
  const box = el.querySelector('#fasting');
  if (!box) return;
  animate(box);
  fastTimer = setInterval(() => {
    if (!document.body.contains(box)) return clearInterval(fastTimer);
    box.innerHTML = fastingHtml(app);
    box.querySelectorAll('.anim').forEach((a) => a.classList.add('in'));
  }, 30000);
}
