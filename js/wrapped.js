// Weekly Wrapped: the story slides for a 7-day period. Pure (tested with `npm test`).
import * as N from './nutrition.js';
import { consumption } from './awards.js';

/** Monday of the week containing `date`. */
export function mondayOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon = 0
  return N.addDays(date, -dow);
}

/** The last fully finished Monday–Sunday week before `today`. */
export const lastWeekStart = (today = N.dateStr()) => N.addDays(mondayOf(today), -7);

const round = (v) => Math.round(v);
const local = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d); };
const plural = (n, word, many = `${word}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? word : many}`;

// Fun equivalents (approximate).
const KCAL_THINGS = [
  { kcal: 180, emoji: '🍩', name: 'koeksister', many: 'koeksisters' },
  { kcal: 550, emoji: '🍔', name: 'Big Mac', many: 'Big Macs' },
  { kcal: 285, emoji: '🍕', name: 'slice of pizza', many: 'slices of pizza' },
  { kcal: 2600, emoji: '🏃', name: 'marathon’s worth of running', many: 'marathons’ worth of running' },
];

/**
 * Slides for the 7 days starting `start`: [{ id, emoji, kicker, big, sub, theme }].
 * Returns null if nothing was logged that week.
 */
export function weekWrapped(data, start) {
  const end = N.addDays(start, 6);
  const logs = data.logs || [];
  const rep = N.periodReport(logs, end, 7);
  const logged = rep.days.filter((d) => d.entries.some((e) => e.type !== 'exercise'));
  if (!logged.length) return null;

  const target = N.dailyTarget(data.settings || {});
  const weekLogs = logs.filter((l) => l.date >= start && l.date <= end);
  const food = weekLogs.filter((l) => l.type !== 'exercise');
  const slides = [];
  const range = (d) => local(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  slides.push({ id: 'intro', emoji: '🎁', kicker: 'Your week, wrapped', big: `${range(start)} – ${range(end)}`, sub: `${plural(logged.length, 'day')} logged · ${plural(food.length, 'entry', 'entries')}`, theme: 'green' });

  const total = rep.total.kcal;
  const thing = KCAL_THINGS[Math.min(KCAL_THINGS.length - 1, total > 20000 ? 3 : total > 9000 ? 1 : total > 3000 ? 2 : 0)];
  slides.push({ id: 'total', emoji: thing.emoji, kicker: 'You ate', big: `${round(total).toLocaleString('en-GB')} kcal`,
    sub: `That’s about ${plural(Math.max(1, round(total / thing.kcal)), thing.name, thing.many)} (${round(N.kcalToKj(total)).toLocaleString('en-GB')} kJ)`, theme: 'amber' });

  if (target.kcal) {
    const onTarget = logged.filter((d) => d.eaten.kcal <= target.kcal + (target.addExercise ? d.burned : 0)).length;
    const diff = rep.average.kcal - target.kcal;
    slides.push({ id: 'target', emoji: onTarget === logged.length ? '🎯' : onTarget ? '👍' : '😅', kicker: 'On target',
      big: `${onTarget} of ${logged.length} days`,
      sub: `You averaged ${round(rep.average.kcal).toLocaleString('en-GB')} kcal a day, ${round(Math.abs(diff))} ${diff > 0 ? 'over' : 'under'} your target`, theme: 'blue' });
  }

  const best = [...logged].sort((a, b) => b.eaten.protein - a.eaten.protein)[0];
  slides.push({ id: 'protein', emoji: '💪', kicker: 'Protein', big: `${round(rep.total.protein)} g`,
    sub: `About ${plural(round(rep.total.protein / 6), 'egg')}’ worth. Best day: ${round(best.eaten.protein)} g on ${local(best.date).toLocaleDateString('en-GB', { weekday: 'long' })}`, theme: 'green' });

  const counts = new Map();
  for (const l of food) {
    const key = String(l.type === 'meal' ? String(l.name).split(': ')[0] : l.name);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const fav = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const top = N.topSources(logs, start, end, 1)[0];
  slides.push({ id: 'favourite', emoji: '❤️', kicker: 'Your favourite', big: fav[0], sub: `Logged ${plural(fav[1], 'time')}${top && top.name !== fav[0] ? ` · Biggest calorie source: ${top.name}` : ''}`, theme: 'pink' });

  const cons = consumption({ ...data, logs: weekLogs });
  let coffees = 0;
  for (const row of cons.values()) {
    if (/coffee|latte|cappuccino|americano|flat white/i.test(row.item.name)) coffees += row.servings;
    else if (/^espresso$/i.test(row.item.name)) coffees += row.direct;
  }
  if (coffees >= 1) {
    slides.push({ id: 'coffee', emoji: '☕', kicker: 'Caffeine report', big: plural(round(coffees), 'coffee'),
      sub: coffees >= 14 ? 'Enough to power a small office' : coffees >= 7 ? 'One a day keeps the grumpy away' : 'Pacing yourself, respect', theme: 'amber' });
  }

  const split = N.mealTimeSplit(logs, start, end).sort((a, b) => b.share - a.share);
  const late = split.find((r) => r.id === 'late');
  slides.push({ id: 'when', emoji: split[0].emoji, kicker: 'Biggest meal time', big: split[0].label,
    sub: `${round(split[0].share * 100)}% of your calories${late.share >= 0.1 && split[0].id !== 'late' ? ` · late-night snacks were ${round(late.share * 100)}% 🌙` : ''}`, theme: 'blue' });

  if (rep.burned > 0) {
    slides.push({ id: 'exercise', emoji: '🔥', kicker: 'You burned', big: `${round(rep.burned).toLocaleString('en-GB')} kcal`,
      sub: `With exercise. That’s ${plural(Math.max(1, round(rep.burned / 285)), 'slice')} of pizza walked off`, theme: 'pink' });
  }

  const ws = (data.weights || []).filter((w) => N.num(w.weightKg) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const before = [...ws].filter((w) => w.date < start).pop();
  const inWeek = ws.filter((w) => w.date >= start && w.date <= end);
  const from = before || inWeek[0];
  const to = inWeek[inWeek.length - 1];
  if (from && to && from !== to) {
    const ch = N.num(to.weightKg) - N.num(from.weightKg);
    slides.push({ id: 'weight', emoji: ch < 0 ? '📉' : ch > 0 ? '📈' : '⚖️', kicker: 'Weight', big: `${ch > 0 ? '+' : ch < 0 ? '−' : ''}${Math.abs(ch).toFixed(1)} kg`,
      sub: `${N.num(from.weightKg)} kg → ${N.num(to.weightKg)} kg`, theme: 'green' });
  }

  slides.push({ id: 'outro', emoji: '🚀', kicker: 'That’s a wrap', big: 'See you next week', sub: logged.length === 7 ? 'Logged every single day. Legend.' : 'Every day you log makes the next Wrapped better', theme: 'green' });
  return slides;
}
