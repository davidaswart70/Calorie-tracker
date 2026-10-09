// Awards: streak and milestone badges, serious and silly. Pure functions (tested with `npm test`).
import * as N from './nutrition.js';

// ---------- How much of each saved item has been eaten ----------

/**
 * Totals per saved food/drink across all logs, expanding recipes, drinks made from
 * ingredients and logged meals. Returns Map 'type:id' → { item, type, amount (g/ml), servings, direct }.
 * `direct` counts servings logged on their own (not as an ingredient of something else).
 */
export function consumption(data) {
  const out = new Map();
  let depthNow = 0;
  const bump = (type, item, amount, servings) => {
    const key = `${type}:${item.id}`;
    const row = out.get(key) || { item, type, amount: 0, servings: 0, direct: 0 };
    row.amount += amount;
    row.servings += servings;
    if (depthNow === 0) row.direct += servings;
    out.set(key, row);
  };

  const eat = (type, item, qty, unit, depth = 0) => {
    qty = N.num(qty);
    depthNow = depth;
    if (!item || qty <= 0 || depth > 4) return;
    if (type === 'recipe') {
      const factor = qty / (N.num(item.servings) || 1);
      for (const ing of N.ingredientsOf(data, 'recipe', item.id)) {
        eat(ing.itemType, N.findItem(data, ing.itemType, ing.itemId), N.num(ing.quantity) * factor, ing.unit, depth + 1);
      }
      return;
    }
    if (type === 'drink' && N.ingredientsOf(data, 'drink', item.id).length) {
      const servings = unit === 'serving' ? qty : N.num(item.servingSize) ? qty / N.num(item.servingSize) : 0;
      bump(type, item, 0, servings);
      for (const ing of N.ingredientsOf(data, 'drink', item.id)) {
        eat(ing.itemType, N.findItem(data, ing.itemType, ing.itemId), N.num(ing.quantity) * servings, ing.unit, depth + 1);
      }
      return;
    }
    if (item.unit === 'serving') return bump(type, item, 0, qty);
    if (unit === 'serving') return bump(type, item, qty * N.num(item.servingSize), qty);
    const size = N.num(item.servingSize);
    bump(type, item, qty, size ? qty / size : 0);
  };

  // Meals are logged as "Name: 2 × Item, 70 g Item, …" (see screens/meal.js).
  const byName = new Map();
  for (const type of ['food', 'drink']) for (const item of data[`${type}s`] || []) byName.set(item.name.toLowerCase(), { type, item });

  for (const l of data.logs || []) {
    if (l.type === 'exercise') continue;
    if (l.type === 'meal') {
      const contents = String(l.name).slice(String(l.name).indexOf(': ') + 2);
      for (const part of contents.split(', ')) {
        const m = part.match(/^([\d.,]+)\s*(?:×\s*|(g|ml)\s+)(.+)$/);
        const found = m && byName.get(m[3].trim().toLowerCase());
        if (found) eat(found.type, found.item, N.num(m[1]), m[2] || 'serving');
      }
      continue;
    }
    eat(l.type, N.findItem(data, l.type, l.itemId), l.quantity, l.unit);
  }
  return out;
}

/** Total grams/ml and servings of items whose name matches `re`. */
function matching(cons, re) {
  let amount = 0, servings = 0, direct = 0;
  for (const row of cons.values()) {
    if (re.test(row.item.name)) { amount += row.amount; servings += row.servings; direct += row.direct; }
  }
  return { amount, servings, direct };
}

// ---------- Badges ----------

const tiers = (base, list) => list.map(([goal, emoji, title, desc]) => ({ ...base, id: `${base.id}-${goal}`, goal, emoji, title, desc }));

/**
 * Every badge with its progress. `value(ctx)` gives the current number; earned when value ≥ goal.
 * `fmt` turns a number into text for the progress line.
 */
const BADGES = [
  // Streaks
  ...tiers({ id: 'streak', group: 'Streaks', value: (c) => c.streaks.logging.best, fmt: (v) => `${v} days` }, [
    [3, '🌱', 'Getting started', 'Log food 3 days in a row'],
    [7, '🔥', 'On fire', 'Log food 7 days in a row'],
    [30, '📅', 'Habit formed', 'Log food 30 days in a row'],
    [100, '💯', 'Centurion', 'Log food 100 days in a row'],
  ]),
  ...tiers({ id: 'target', group: 'Streaks', value: (c) => c.streaks.onTarget.best, fmt: (v) => `${v} days` }, [
    [3, '🎯', 'Bullseye', 'Stay on target 3 days in a row'],
    [7, '🏹', 'Sharpshooter', 'Stay on target 7 days in a row'],
    [21, '🧘', 'Zen master', 'Stay on target 21 days in a row'],
  ]),
  ...tiers({ id: 'protein-streak', group: 'Streaks', value: (c) => c.streaks.protein.best, fmt: (v) => `${v} days` }, [
    [3, '💪', 'Gains', 'Hit your protein goal 3 days in a row'],
    [7, '🦾', 'Protein machine', 'Hit your protein goal 7 days in a row'],
  ]),

  // Weight
  ...tiers({ id: 'lost', group: 'Weight', value: (c) => c.lostKg, fmt: (v) => `${N.roundTo(v, 0.1).toFixed(1)} kg` }, [
    [1, '🪶', 'Lighter already', 'Lose your first kilogram'],
    [2.5, '📉', 'Downhill (the good kind)', 'Lose 2.5 kg'],
    [5, '🏋️', 'Bag of potatoes', 'Lose 5 kg, a whole bag of potatoes'],
    [10, '🎳', 'Bowling ball', 'Lose 10 kg, roughly 1.5 bowling balls'],
  ]),
  ...tiers({ id: 'weighins', group: 'Weight', value: (c) => c.weighIns, fmt: (v) => `${v} weigh-ins` }, [
    [5, '⚖️', 'Scale friend', 'Log your weight 5 times'],
    [20, '📈', 'Data nerd', 'Log your weight 20 times'],
  ]),

  // Totals
  ...tiers({ id: 'entries', group: 'Milestones', value: (c) => c.entries, fmt: (v) => `${v} entries` }, [
    [1, '✏️', 'Hello world', 'Log your first entry'],
    [100, '🗂️', 'Record keeper', 'Log 100 entries'],
    [500, '📚', 'Food historian', 'Log 500 entries'],
  ]),
  ...tiers({ id: 'protein-total', group: 'Milestones', value: (c) => c.proteinKg, fmt: (v) => `${v.toFixed(1)} kg protein` }, [
    [1, '🥚', 'Protein pyramid', 'Eat 1 kg of protein in total'],
    [5, '🗿', 'Built different', 'Eat 5 kg of protein in total'],
  ]),
  ...tiers({ id: 'kcal-total', group: 'Milestones', value: (c) => c.kcalTotal, fmt: (v) => `${N.roundTo(v, 1000).toLocaleString('en-GB')} kcal` }, [
    [100000, '🐘', 'Ate an elephant (sort of)', 'Log 100,000 kcal in total'],
    [500000, '🚀', 'Rocket fuel', 'Log 500,000 kcal in total'],
  ]),
  ...tiers({ id: 'exercise', group: 'Milestones', value: (c) => c.burnedTotal / 285, fmt: (v) => `${Math.floor(v)} slices of pizza` }, [
    [10, '🍕', 'Walked off a pizza', 'Burn off 10 slices of pizza with exercise (~2,850 kcal)'],
    [50, '🏃', 'Pizza party, cancelled', 'Burn off 50 slices of pizza with exercise'],
  ]),

  // Silly food ones
  ...tiers({ id: 'beef', group: 'Just for fun', value: (c) => c.food(/beef|steak|mince|biltong|burger|brisket|droëwors|boerewors/i).amount / 1000, fmt: (v) => `${v.toFixed(1)} kg beef` }, [
    [1, '🥩', 'Steakholder', 'Eat 1 kg of beef'],
    [55, '🐄', 'A quarter of a cow', 'Eat 55 kg of beef, about a quarter of a cow'],
    [220, '🤠', 'The whole cow', 'Eat 220 kg of beef. Moo.'],
  ]),
  ...tiers({ id: 'chicken', group: 'Just for fun', value: (c) => c.food(/chicken/i).amount / 350, fmt: (v) => `${v.toFixed(1)} chickens` }, [
    [1, '🐔', 'Why did the chicken…', 'Eat a whole chicken’s worth of chicken (~350 g)'],
    [10, '🐓', 'Flock off', 'Eat 10 chickens’ worth'],
    [50, '🍗', 'The Colonel', 'Eat 50 chickens’ worth'],
  ]),
  ...tiers({ id: 'avo', group: 'Just for fun', value: (c) => c.food(/avocado|\bavo\b/i).amount / 170, fmt: (v) => `${v.toFixed(1)} avocados` }, [
    [10, '🥑', 'Avo-cardio', 'Eat 10 avocados (~170 g each)'],
    [50, '🏠', 'Goodbye house deposit', 'Eat 50 avocados. Millennial status: unlocked'],
  ]),
  ...tiers({ id: 'coffee', group: 'Just for fun', value: (c) => c.coffees, fmt: (v) => `${Math.floor(v)} coffees` }, [
    [10, '☕', 'Bean there', 'Have 10 coffees'],
    [100, '🫘', 'Barista’s best friend', 'Have 100 coffees'],
    [365, '⚡', 'Coffee is a food group', 'Have 365 coffees'],
  ]),
  ...tiers({ id: 'ham', group: 'Just for fun', value: (c) => c.food(/\bham\b|bacon|pork/i).amount / 1000, fmt: (v) => `${v.toFixed(1)} kg` }, [
    [1, '🐷', 'This little piggy', 'Eat 1 kg of ham, bacon or pork'],
  ]),
  ...tiers({ id: 'yoghurt', group: 'Just for fun', value: (c) => c.food(/yog/i).amount / 1000, fmt: (v) => `${v.toFixed(1)} kg yoghurt` }, [
    [5, '🦠', 'Culture club', 'Eat 5 kg of yoghurt. Very cultured.'],
  ]),
  ...tiers({ id: 'rooibos', group: 'Just for fun', value: (c) => c.food(/rooibos/i).servings, fmt: (v) => `${Math.floor(v)} cups` }, [
    [50, '🇿🇦', 'Proudly South African', 'Drink 50 rooibos teas or iced teas'],
  ]),
  ...tiers({ id: 'fizz', group: 'Just for fun', value: (c) => c.food(/sparkling|soda water/i).servings, fmt: (v) => `${Math.floor(v)} drinks` }, [
    [50, '🫧', 'Fizz whizz', 'Have 50 sparkling waters'],
  ]),
  ...tiers({ id: 'night', group: 'Just for fun', value: (c) => c.lateNight, fmt: (v) => `${v} times` }, [
    [1, '🌙', 'Midnight raider', 'Log something after 22:00'],
    [10, '🦉', 'Night owl', 'Log something after 22:00 ten times'],
  ]),
  ...tiers({ id: 'early', group: 'Just for fun', value: (c) => c.earlyBird, fmt: (v) => `${v} times` }, [
    [1, '🐦', 'Early bird', 'Log something before 06:00'],
  ]),
];

/** Evaluate every badge against the data. Returns [{ ...badge, value, earned, progress }]. */
export function evaluateAwards(data, today = N.dateStr()) {
  const logs = data.logs || [];
  const food = logs.filter((l) => l.type !== 'exercise');
  const weights = [...(data.weights || [])].filter((w) => N.num(w.weightKg) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const cons = consumption(data);
  const time = (l) => String(l.time || '');

  const ctx = {
    streaks: N.streaks(logs, data.settings || {}, today),
    lostKg: weights.length > 1 ? Math.max(0, N.num(weights[0].weightKg) - Math.min(...weights.map((w) => N.num(w.weightKg)))) : 0,
    weighIns: weights.length,
    entries: logs.length,
    proteinKg: food.reduce((s, l) => s + N.num(l.protein), 0) / 1000,
    kcalTotal: food.reduce((s, l) => s + N.num(l.kcal), 0),
    burnedTotal: logs.filter((l) => l.type === 'exercise').reduce((s, l) => s + N.num(l.kcal), 0),
    food: (re) => matching(cons, re),
    lateNight: food.filter((l) => time(l) >= '22:00').length,
    earlyBird: food.filter((l) => time(l) && time(l) < '06:00').length,
  };
  // Coffees: coffee drinks, plus espressos logged on their own (not the shot inside an iced coffee).
  ctx.coffees = matching(cons, /coffee|latte|cappuccino|americano|flat white/i).servings + matching(cons, /^espresso$/i).direct;

  return BADGES.map((b) => {
    const value = b.value(ctx) || 0;
    return { ...b, value, earned: value >= b.goal, progress: Math.min(1, value / b.goal), progressText: `${b.fmt(Math.min(value, b.goal))} of ${b.fmt(b.goal)}` };
  });
}
