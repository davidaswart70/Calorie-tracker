// All calorie, macro and energy maths lives here.
// Pure functions only (no DOM, no storage) so it can be unit-tested with `npm test`.

// ---------- Units & basic helpers ----------

export const KJ_PER_KCAL = 4.184;

// Atwater factors: kcal per gram.
export const ATWATER = { protein: 4, carbs: 4, fat: 9, alcohol: 7 };

export const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export const kcalToKj = (kcal) => num(kcal) * KJ_PER_KCAL;

export function kcalFromMacros({ protein = 0, carbs = 0, fat = 0, alcohol = 0 }) {
  return num(protein) * ATWATER.protein + num(carbs) * ATWATER.carbs +
    num(fat) * ATWATER.fat + num(alcohol) * ATWATER.alcohol;
}

export const zero = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

export function addTotals(a, b) {
  return {
    kcal: a.kcal + num(b.kcal),
    protein: a.protein + num(b.protein),
    carbs: a.carbs + num(b.carbs),
    fat: a.fat + num(b.fat),
  };
}

export function scale(t, factor) {
  return {
    kcal: num(t.kcal) * factor,
    protein: num(t.protein) * factor,
    carbs: num(t.carbs) * factor,
    fat: num(t.fat) * factor,
  };
}

// ---------- Saved items (foods, drinks, recipes) ----------
//
// Foods and simple drinks store nutrition per 100 g or per 100 ml (item.unit),
// with an optional servingSize in that unit — or, when item.unit is 'serving', per one serving.
// Recipes, and drinks that have ingredients, are calculated from their ingredients.
// Ingredient rows: { parentType: 'recipe'|'drink', parentId, itemType: 'food'|'drink', itemId, quantity, unit }

const TABLE = { food: 'foods', drink: 'drinks', recipe: 'recipes' };

export function findItem(data, type, id) {
  return (data[TABLE[type]] || []).find((x) => x.id === id) || null;
}

export function ingredientsOf(data, parentType, parentId) {
  return (data.ingredients || []).filter((i) => i.parentType === parentType && i.parentId === parentId);
}

export function isComposite(data, type, item) {
  return type === 'recipe' || (type === 'drink' && ingredientsOf(data, 'drink', item.id).length > 0);
}

// Units an item can be logged in.
export function unitsFor(data, type, item) {
  if (isComposite(data, type, item) || item.unit === 'serving') return ['serving'];
  const units = [item.unit || 'g'];
  if (num(item.servingSize) > 0) units.push('serving');
  return units;
}

// Sum all ingredients of a recipe or composite drink (the whole batch).
export function compositeTotals(data, parentType, parentId, depth = 0) {
  let totals = zero();
  let estimated = false;
  const missing = [];
  for (const ing of ingredientsOf(data, parentType, parentId)) {
    const item = findItem(data, ing.itemType, ing.itemId);
    if (!item || depth > 3) { missing.push(ing.itemId); estimated = true; continue; }
    const n = nutritionFor(data, ing.itemType, item, ing.quantity, ing.unit, depth + 1);
    totals = addTotals(totals, n);
    if (n.source !== 'label') estimated = true;
    missing.push(...n.missing);
  }
  return { ...totals, source: estimated ? 'estimated' : 'label', missing };
}

// Nutrition for `quantity` of `unit` ('g' | 'ml' | 'serving') of a saved item.
// Returns { kcal, protein, carbs, fat, source, missing }.
export function nutritionFor(data, type, item, quantity, unit, depth = 0) {
  const qty = num(quantity);

  if (type === 'recipe') {
    const batch = compositeTotals(data, 'recipe', item.id, depth);
    const servings = num(item.servings) || 1;
    return { ...scale(batch, qty / servings), source: batch.source, missing: batch.missing };
  }

  if (type === 'drink' && ingredientsOf(data, 'drink', item.id).length > 0) {
    // One serving = one made drink (all ingredients).
    const drink = compositeTotals(data, 'drink', item.id, depth);
    let factor = qty;
    if (unit !== 'serving') factor = num(item.servingSize) > 0 ? qty / num(item.servingSize) : 0;
    return { ...scale(drink, factor), source: drink.source, missing: drink.missing };
  }

  if (item.unit === 'serving') {
    return { ...scale(item, unit === 'serving' ? qty : 0), source: item.source === 'label' ? 'label' : 'estimated', missing: [] };
  }
  const amount = unit === 'serving' ? qty * num(item.servingSize) : qty;
  return { ...scale(item, amount / 100), source: item.source === 'label' ? 'label' : 'estimated', missing: [] };
}

// Nutrition for one serving (or 100 g/ml when no serving size), used for list display.
export function displayPortion(data, type, item) {
  if (isComposite(data, type, item) || item.unit === 'serving') {
    return { label: '1 serving', ...nutritionFor(data, type, item, 1, 'serving') };
  }
  return { label: `100 ${item.unit || 'g'}`, ...nutritionFor(data, type, item, 100, item.unit || 'g') };
}

// ---------- Energy expenditure & goals ----------

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Desk job, little or no exercise', factor: 1.2 },
  { id: 'light', label: 'Lightly active', desc: 'Exercise 1–3 days a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active', desc: 'Exercise 3–5 days a week', factor: 1.55 },
  { id: 'very', label: 'Very active', desc: 'Exercise 6–7 days a week', factor: 1.725 },
  { id: 'extra', label: 'Extremely active', desc: 'Physical job plus training', factor: 1.9 },
];

// Protein targets in g per kg body weight (common sports-nutrition ranges).
export const GOALS = [
  { id: 'lose_fast', label: 'Lose faster', kgPerWeek: -0.75, proteinPerKg: 2.0 },
  { id: 'lose', label: 'Lose weight', kgPerWeek: -0.5, proteinPerKg: 2.0 },
  { id: 'lose_slow', label: 'Lose slowly', kgPerWeek: -0.25, proteinPerKg: 1.8 },
  { id: 'maintain', label: 'Maintain', kgPerWeek: 0, proteinPerKg: 1.6 },
  { id: 'gain_slow', label: 'Gain slowly', kgPerWeek: 0.25, proteinPerKg: 1.8 },
  { id: 'gain', label: 'Gain weight', kgPerWeek: 0.5, proteinPerKg: 1.8 },
];

// ~7700 kcal per kg of body fat (rule of thumb).
export const KCAL_PER_KG = 7700;

// Commonly cited minimum daily intake without medical supervision.
export const MIN_KCAL = { female: 1200, male: 1500 };

export const FAT_SHARE = 0.25; // 25 % of calories from fat

export function profileFromSettings(s = {}) {
  return {
    sex: s.sex === 'female' ? 'female' : s.sex === 'male' ? 'male' : '',
    age: num(s.age),
    heightCm: num(s.heightCm),
    weightKg: num(s.weightKg),
    bodyFatPct: num(s.bodyFatPct),
    activityLevel: s.activityLevel || '',
    goal: s.goal || 'maintain',
  };
}

export function profileComplete(p) {
  return Boolean(p.sex && p.age > 0 && p.heightCm > 0 && p.weightKg > 0 && activityFactor(p.activityLevel));
}

export function activityFactor(id) {
  return ACTIVITY_LEVELS.find((a) => a.id === id)?.factor || 0;
}

// Mifflin–St Jeor (1990).
export function bmrMifflin({ sex, weightKg, heightCm, age }) {
  const base = 10 * num(weightKg) + 6.25 * num(heightCm) - 5 * num(age);
  return sex === 'female' ? base - 161 : base + 5;
}

// Katch–McArdle, used when body fat % is known.
export function bmrKatch({ weightKg, bodyFatPct }) {
  const leanKg = num(weightKg) * (1 - num(bodyFatPct) / 100);
  return 370 + 21.6 * leanKg;
}

export function bmr(p) {
  if (num(p.bodyFatPct) > 0 && num(p.bodyFatPct) < 70) {
    return { value: bmrKatch(p), formula: 'Katch–McArdle' };
  }
  return { value: bmrMifflin(p), formula: 'Mifflin–St Jeor' };
}

export const tdee = (p) => bmr(p).value * activityFactor(p.activityLevel);

export const goalAdjustment = (kgPerWeek) => (num(kgPerWeek) * KCAL_PER_KG) / 7;

export const roundTo = (v, step) => Math.round(v / step) * step;

// Recommended daily calories for a goal. Returns null if the profile is incomplete.
export function recommendCalories(p, goalId = p.goal) {
  if (!profileComplete(p)) return null;
  const goal = GOALS.find((g) => g.id === goalId) || GOALS.find((g) => g.id === 'maintain');
  const b = bmr(p);
  const maintenance = tdee(p);
  const adjustment = goalAdjustment(goal.kgPerWeek);
  const raw = maintenance + adjustment;
  const floor = MIN_KCAL[p.sex];
  const floored = raw < floor;
  return {
    goal,
    bmr: b.value,
    formula: b.formula,
    tdee: maintenance,
    adjustment,
    target: roundTo(Math.max(raw, floor), 10),
    floored,
    floor,
  };
}

export function macroTargets(kcal, weightKg, goalId) {
  const goal = GOALS.find((g) => g.id === goalId) || GOALS.find((g) => g.id === 'maintain');
  const protein = num(weightKg) * goal.proteinPerKg;
  const fat = (num(kcal) * FAT_SHARE) / ATWATER.fat;
  const carbs = Math.max(0, (num(kcal) - protein * ATWATER.protein - fat * ATWATER.fat) / ATWATER.carbs);
  return { protein, carbs, fat };
}

// The daily target the app uses: manual override if set, otherwise the recommendation.
export function dailyTarget(settings = {}) {
  const p = profileFromSettings(settings);
  const rec = recommendCalories(p);
  const override = num(settings.calorieTarget);
  const kcal = override > 0 ? override : rec ? rec.target : 0;
  return {
    kcal,
    manual: override > 0,
    recommendation: rec,
    macros: kcal ? macroTargets(kcal, p.weightKg, p.goal) : null,
    addExercise: settings.addExercise === 'yes',
  };
}

// ---------- Exercise ----------

// MET values from the Compendium of Physical Activities (approximate).
export const EXERCISES = [
  { id: 'walk', label: 'Walking (5 km/h)', met: 3.5 },
  { id: 'walk_brisk', label: 'Brisk walking (6 km/h)', met: 4.3 },
  { id: 'hike', label: 'Hiking', met: 6.0 },
  { id: 'run_8', label: 'Running (8 km/h)', met: 8.3 },
  { id: 'run_10', label: 'Running (10 km/h)', met: 9.8 },
  { id: 'cycle', label: 'Cycling (moderate, 16–19 km/h)', met: 6.8 },
  { id: 'swim', label: 'Swimming (moderate)', met: 5.8 },
  { id: 'strength', label: 'Strength training', met: 5.0 },
  { id: 'yoga', label: 'Yoga', met: 2.5 },
  { id: 'garden', label: 'Gardening', met: 3.8 },
];

// Net calories burned: (MET − 1) × kg × hours.
// The "− 1" removes resting energy that BMR already counts.
export function exerciseKcal(met, weightKg, minutes) {
  return Math.max(0, num(met) - 1) * num(weightKg) * (num(minutes) / 60);
}

// ---------- Dates & reports ----------

export function dateStr(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  return dateStr(new Date(y, m - 1, d + n));
}

export const isExercise = (log) => log.type === 'exercise';

export function dayTotals(logs, date) {
  const entries = logs.filter((l) => l.date === date);
  let eaten = zero();
  let burned = 0;
  for (const l of entries) {
    if (isExercise(l)) burned += num(l.kcal);
    else eaten = addTotals(eaten, l);
  }
  return { date, entries, eaten, burned };
}

export function remainingKcal(target, day) {
  const allowance = target.kcal + (target.addExercise ? day.burned : 0);
  return allowance - day.eaten.kcal;
}

// `length` days ending on `endDate`, with averages over days that have food logged.
export function periodReport(logs, endDate, length) {
  const days = [];
  for (let i = length - 1; i >= 0; i--) days.push(dayTotals(logs, addDays(endDate, -i)));
  const logged = days.filter((d) => d.entries.some((e) => !isExercise(e)));
  let total = zero();
  for (const d of logged) total = addTotals(total, d.eaten);
  const n = logged.length || 1;
  return {
    start: days[0].date,
    end: endDate,
    days,
    daysLogged: logged.length,
    total,
    average: scale(total, 1 / n),
    burned: days.reduce((s, d) => s + d.burned, 0),
  };
}

export const weeklyReport = (logs, endDate) => periodReport(logs, endDate, 7);

// Calories from each macro (Atwater) and each one's share of those calories.
export function macroEnergy(t) {
  const protein = num(t.protein) * ATWATER.protein;
  const carbs = num(t.carbs) * ATWATER.carbs;
  const fat = num(t.fat) * ATWATER.fat;
  const total = protein + carbs + fat;
  const share = (v) => (total ? v / total : 0);
  return { protein, carbs, fat, total, shares: { protein: share(protein), carbs: share(carbs), fat: share(fat) } };
}

// Running calorie total through a day: [{ minutes, kcal, name }], sorted by time.
export function cumulativeByTime(entries) {
  let total = 0;
  return entries
    .filter((e) => !isExercise(e))
    .map((e) => {
      const [h, m] = String(e.time || '12:00').split(':').map(Number);
      return { minutes: (h || 0) * 60 + (m || 0), kcal: num(e.kcal), name: e.name };
    })
    .sort((a, b) => a.minutes - b.minutes)
    .map((e) => ({ ...e, kcal: (total += e.kcal) }));
}

// Weight trend in kg per week (least-squares slope), or null with fewer than 2 entries.
export function weightRate(weights) {
  const pts = weights
    .filter((w) => num(w.weightKg) > 0)
    .map((w) => { const [y, m, d] = w.date.split('-').map(Number); return [Date.UTC(y, m - 1, d) / 86400000, num(w.weightKg)]; });
  if (pts.length < 2) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  if (!sxx) return null;
  const sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
  return (sxy / sxx) * 7;
}

// Items that contributed the most calories between two dates (inclusive).
export function topSources(logs, from, to, limit = 5) {
  const byName = new Map();
  let all = 0;
  for (const l of logs) {
    if (isExercise(l) || l.date < from || l.date > to) continue;
    const key = l.name.trim().toLowerCase();
    const row = byName.get(key) || { name: l.name, kcal: 0, count: 0 };
    row.kcal += num(l.kcal);
    row.count += 1;
    byName.set(key, row);
    all += num(l.kcal);
  }
  return [...byName.values()]
    .sort((a, b) => b.kcal - a.kcal)
    .slice(0, limit)
    .map((r) => ({ ...r, share: all ? r.kcal / all : 0 }));
}

// Latest weight entry on or before a date.
export function latestWeight(weights, onOrBefore = '9999-12-31') {
  return [...weights]
    .filter((w) => w.date <= onOrBefore && num(w.weightKg) > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}

// ---------- Real maintenance (adaptive TDEE) ----------

export const ADAPTIVE = { windowDays: 28, minSpanDays: 14, minLoggedDays: 10, minLoggedShare: 0.7 };

const dayNum = (str) => { const [y, m, d] = str.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };

/**
 * Estimate actual maintenance calories from logged intake and the weight trend:
 * maintenance = average intake − (weight change per day × 7700).
 * Uses up to the last 28 days; needs weigh-ins at least 14 days apart and most days logged.
 */
export function realMaintenance(logs, weights, settings, today = dateStr()) {
  const windowStart = addDays(today, -(ADAPTIVE.windowDays - 1));
  const ws = weights
    .filter((w) => num(w.weightKg) > 0 && w.date >= windowStart && w.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const span = ws.length >= 2 ? dayNum(ws[ws.length - 1].date) - dayNum(ws[0].date) : 0;
  const from = ws.length ? ws[0].date : today;
  const to = ws.length ? ws[ws.length - 1].date : today;
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(dayTotals(logs, d));
  const logged = days.filter((d) => d.entries.some((e) => !isExercise(e)));
  const base = { span, loggedDays: logged.length, periodDays: days.length, needDays: ADAPTIVE.minSpanDays };

  if (ws.length < 2 || span < ADAPTIVE.minSpanDays) return { ready: false, reason: 'weights', ...base };
  if (logged.length < ADAPTIVE.minLoggedDays || logged.length / days.length < ADAPTIVE.minLoggedShare) {
    return { ready: false, reason: 'logs', ...base };
  }

  const avgIntake = logged.reduce((s, d) => s + d.eaten.kcal, 0) / logged.length;
  const avgBurned = days.reduce((s, d) => s + d.burned, 0) / days.length;
  const rate = weightRate(ws); // kg per week
  const maintenance = avgIntake - (rate / 7) * KCAL_PER_KG;

  const p = profileFromSettings(settings);
  const goal = GOALS.find((g) => g.id === p.goal) || GOALS.find((g) => g.id === 'maintain');
  const formula = profileComplete(p) ? tdee(p) : null;
  // If logged exercise is added back to the allowance, leave the average exercise out of the base target.
  const base2 = maintenance - (settings.addExercise === 'yes' ? avgBurned : 0);
  const floor = MIN_KCAL[p.sex] || 0;
  const raw = base2 + goalAdjustment(goal.kgPerWeek);
  return {
    ready: true, ...base,
    avgIntake, avgBurned, rate, maintenance, formula, goal,
    suggested: roundTo(Math.max(raw, floor), 10),
    floored: raw < floor,
    current: dailyTarget(settings).kcal,
  };
}

// ---------- Streaks ----------

/**
 * Current and best runs of consecutive days: logging anything, staying at/under target,
 * and reaching 90 % of the protein goal. A streak stays alive if today isn't logged yet.
 */
export function streaks(logs, settings, today = dateStr()) {
  const target = dailyTarget(settings);
  const byDate = new Map();
  for (const l of logs) if (l.date && l.date <= today) byDate.set(l.date, true);
  const dates = [...byDate.keys()].sort();
  const result = {};
  const tests = {
    logging: (d) => d.entries.some((e) => !isExercise(e)),
    onTarget: (d) => target.kcal > 0 && d.entries.some((e) => !isExercise(e)) && d.eaten.kcal <= target.kcal + (target.addExercise ? d.burned : 0),
    protein: (d) => target.macros && d.eaten.protein >= target.macros.protein * 0.9,
  };
  for (const [key, ok] of Object.entries(tests)) {
    let best = 0, run = 0, prev = null;
    for (const date of dates) {
      const good = ok(dayTotals(logs, date));
      if (good && prev && addDays(prev, 1) === date) run += 1;
      else run = good ? 1 : 0;
      if (good) prev = date; else prev = null;
      best = Math.max(best, run);
    }
    // Current: count back from today (or yesterday if today has nothing logged yet).
    let current = 0;
    let d = ok(dayTotals(logs, today)) ? today : addDays(today, -1);
    while (ok(dayTotals(logs, d))) { current += 1; d = addDays(d, -1); }
    result[key] = { current, best: Math.max(best, current) };
  }
  return result;
}

// ---------- Meal times ----------

export const MEAL_TIMES = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🌅', from: '04:00' },
  { id: 'lunch', label: 'Lunch', emoji: '🥪', from: '11:00' },
  { id: 'afternoon', label: 'Afternoon snack', emoji: '🍎', from: '15:00' },
  { id: 'dinner', label: 'Dinner', emoji: '🍽️', from: '17:30' },
  { id: 'late', label: 'Late-night snack', emoji: '🌙', from: '21:30' },
];

const hhmm = (t) => { const [h, m] = String(t || '12:00').split(':'); return `${String(Number(h) || 0).padStart(2, '0')}:${String(Number(m) || 0).padStart(2, '0')}`; };

export function mealTime(time) {
  const t = hhmm(time);
  if (t < MEAL_TIMES[0].from) return MEAL_TIMES[MEAL_TIMES.length - 1]; // after midnight counts as late night
  return [...MEAL_TIMES].reverse().find((m) => t >= m.from);
}

/** Calories per meal time between two dates (inclusive), with each one's share. */
export function mealTimeSplit(logs, from, to) {
  const rows = MEAL_TIMES.map((m) => ({ ...m, kcal: 0, count: 0 }));
  let total = 0;
  for (const l of logs) {
    if (isExercise(l) || l.date < from || l.date > to) continue;
    const row = rows.find((r) => r.id === mealTime(l.time).id);
    row.kcal += num(l.kcal);
    row.count += 1;
    total += num(l.kcal);
  }
  return rows.map((r) => ({ ...r, share: total ? r.kcal / total : 0 }));
}

// ---------- What can I still eat? ----------

/** A sensible single portion of a saved item: 1 serving if it has one, otherwise 100 g/ml. */
export function portionOf(data, type, item) {
  if (isComposite(data, type, item) || item.unit === 'serving' || num(item.servingSize) > 0) return { qty: 1, unit: 'serving' };
  return { qty: 100, unit: item.unit || 'g' };
}

/**
 * Saved items whose usual portion fits in the calories left, best protein-per-calorie first
 * (or the most filling first when protein is already covered). Also lists near-zero-calorie options.
 */
export function suggestions(data, kcalLeft, proteinLeft, limit = 4) {
  const fits = [];
  const free = [];
  for (const type of ['food', 'drink', 'recipe']) {
    for (const item of data[TABLE[type]] || []) {
      const { qty, unit } = portionOf(data, type, item);
      const n = nutritionFor(data, type, item, qty, unit);
      if (n.missing.length) continue;
      if (n.kcal < 5) { free.push({ type, item, qty, unit, n }); continue; }
      if (n.kcal < 20 || n.kcal > kcalLeft) continue;
      const score = proteinLeft > 5 ? n.protein / n.kcal : n.kcal / Math.max(kcalLeft, 1);
      fits.push({ type, item, qty, unit, n, score });
    }
  }
  fits.sort((a, b) => b.score - a.score || b.n.kcal - a.n.kcal);
  return { fits: fits.slice(0, limit), free: free.slice(0, 3) };
}

// ---------- Fasting ----------

/** Entries above this many kcal end a fast (black coffee, rooibos, sparkling water don't). */
export const FAST_BREAK_KCAL = 10;

const minuteOf = (date, time) => { const [h, m] = hhmm(time).split(':').map(Number); return dayNum(date) * 1440 + h * 60 + m; };

/**
 * Time since the last fast-breaking entry, progress toward the goal (hours, 0 = no goal),
 * and a streak of days whose longest completed fast reached the goal.
 */
export function fastingState(logs, goalHours, now = new Date()) {
  const nowMin = dayNum(dateStr(now)) * 1440 + now.getHours() * 60 + now.getMinutes();
  const breaks = logs
    .filter((l) => !isExercise(l) && num(l.kcal) > FAST_BREAK_KCAL && l.date && l.time)
    .map((l) => minuteOf(l.date, l.time))
    .filter((t) => t <= nowMin)
    .sort((a, b) => a - b);
  const last = breaks.length ? breaks[breaks.length - 1] : null;
  const sinceMin = last === null ? null : nowMin - last;
  const goalMin = num(goalHours) * 60;

  // Longest fast that ended on each day (gap before an entry, credited to the entry's day).
  const best = new Map();
  for (let i = 1; i < breaks.length; i++) {
    const day = Math.floor(breaks[i] / 1440);
    best.set(day, Math.max(best.get(day) || 0, breaks[i] - breaks[i - 1]));
  }
  let current = 0, bestRun = 0, run = 0;
  if (goalMin) {
    const days = [...best.keys()].sort((a, b) => a - b);
    let prev = null;
    for (const d of days) {
      const ok = best.get(d) >= goalMin;
      run = ok ? (prev !== null && d === prev + 1 ? run + 1 : 1) : 0;
      prev = ok ? d : null;
      bestRun = Math.max(bestRun, run);
    }
    const today = Math.floor(nowMin / 1440);
    // Today counts if a goal-length fast already ended today, or the ongoing fast has reached the goal.
    let d = (best.get(today) || 0) >= goalMin || (sinceMin !== null && sinceMin >= goalMin) ? today : today - 1;
    if (d === today) { current = 1; d -= 1; }
    while ((best.get(d) || 0) >= goalMin) { current += 1; d -= 1; }
    bestRun = Math.max(bestRun, current);
  }
  return {
    sinceMin, lastAt: last, goalMin,
    progress: goalMin && sinceMin !== null ? Math.min(1, sinceMin / goalMin) : 0,
    reached: Boolean(goalMin && sinceMin !== null && sinceMin >= goalMin),
    endsAtMin: goalMin && last !== null ? last + goalMin : null,
    streak: { current, best: bestRun },
  };
}
