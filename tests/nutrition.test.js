import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../js/nutrition.js';

const close = (actual, expected, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);

const data = {
  foods: [
    { id: 'milk', name: 'Milk', unit: 'ml', servingSize: 250, kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.5, source: 'label' },
    { id: 'wrap', name: 'Tortilla', unit: 'g', servingSize: 60, kcal: 300, protein: 8, carbs: 50, fat: 7, source: 'label' },
    { id: 'chicken', name: 'Chicken breast', unit: 'g', servingSize: '', kcal: 165, protein: 31, carbs: 0, fat: 3.6, source: 'estimated' },
  ],
  drinks: [
    { id: 'beer', name: 'Lager', unit: 'ml', servingSize: 340, kcal: 43, protein: 0.5, carbs: 3.6, fat: 0, source: 'label' },
    { id: 'icedcoffee', name: 'Iced coffee', unit: 'ml', servingSize: 300, source: 'estimated' },
  ],
  recipes: [{ id: 'cw', name: 'Chicken wrap', servings: 2 }],
  ingredients: [
    { parentType: 'drink', parentId: 'icedcoffee', itemType: 'food', itemId: 'milk', quantity: 200, unit: 'ml' },
    { parentType: 'recipe', parentId: 'cw', itemType: 'food', itemId: 'wrap', quantity: 2, unit: 'serving' },
    { parentType: 'recipe', parentId: 'cw', itemType: 'food', itemId: 'chicken', quantity: 200, unit: 'g' },
  ],
};

test('kcal ↔ kJ and Atwater', () => {
  close(N.kcalToKj(100), 418.4);
  assert.equal(N.kcalFromMacros({ protein: 10, carbs: 20, fat: 5 }), 10 * 4 + 20 * 4 + 5 * 9);
  assert.equal(N.num('7,5'), 7.5);
});

test('simple food by grams and by serving', () => {
  const tortilla = data.foods[1];
  close(N.nutritionFor(data, 'food', tortilla, 150, 'g').kcal, 450);
  close(N.nutritionFor(data, 'food', tortilla, 2, 'serving').kcal, 360);
  assert.equal(N.nutritionFor(data, 'food', tortilla, 1, 'g').source, 'label');
});

test('items stored per serving', () => {
  const espresso = { id: 'esp', name: 'Espresso', unit: 'serving', kcal: 2, protein: 0.1, source: 'estimated' };
  assert.deepEqual(N.unitsFor(data, 'drink', espresso), ['serving']);
  assert.equal(N.nutritionFor(data, 'drink', espresso, 3, 'serving').kcal, 6);
  assert.equal(N.displayPortion(data, 'drink', espresso).label, '1 serving');
});

test('composite drink is calculated from its ingredients', () => {
  const ic = data.drinks[1];
  const one = N.nutritionFor(data, 'drink', ic, 1, 'serving');
  close(one.kcal, 128); // 200 ml milk × 64/100
  close(N.nutritionFor(data, 'drink', ic, 2, 'serving').kcal, 256);
  assert.deepEqual(N.unitsFor(data, 'drink', ic), ['serving']);
});

test('recipe per serving, estimated if any ingredient is estimated', () => {
  const r = N.nutritionFor(data, 'recipe', data.recipes[0], 1, 'serving');
  // whole recipe: 2 × 60 g tortilla = 360 kcal + 200 g chicken = 330 kcal → 690 / 2 servings
  close(r.kcal, 345);
  close(r.protein, (2 * 0.6 * 8 + 2 * 31) / 2);
  assert.equal(r.source, 'estimated');
});

test('missing ingredients are reported', () => {
  const d = { ...data, ingredients: [...data.ingredients, { parentType: 'recipe', parentId: 'cw', itemType: 'food', itemId: 'gone', quantity: 1, unit: 'g' }] };
  assert.deepEqual(N.nutritionFor(d, 'recipe', data.recipes[0], 1, 'serving').missing, ['gone']);
});

test('BMR: Mifflin–St Jeor and Katch–McArdle', () => {
  const man = { sex: 'male', age: 40, heightCm: 180, weightKg: 85 };
  assert.equal(N.bmrMifflin(man), 1780);
  assert.equal(N.bmrMifflin({ ...man, sex: 'female' }), 1614);
  close(N.bmrKatch({ weightKg: 85, bodyFatPct: 20 }), 370 + 21.6 * 68);
  assert.equal(N.bmr({ ...man, bodyFatPct: 20 }).formula, 'Katch–McArdle');
});

test('TDEE, goal recommendation and safety floor', () => {
  const p = { sex: 'male', age: 40, heightCm: 180, weightKg: 85, activityLevel: 'moderate', goal: 'lose' };
  close(N.tdee(p), 2759);
  const rec = N.recommendCalories(p);
  close(rec.adjustment, -550);
  assert.equal(rec.target, 2210); // 2209 rounded to 10
  assert.equal(rec.floored, false);

  const small = { sex: 'female', age: 60, heightCm: 150, weightKg: 50, activityLevel: 'sedentary' };
  const low = N.recommendCalories(small, 'lose_fast');
  assert.equal(low.floored, true);
  assert.equal(low.target, 1200);
  assert.equal(N.recommendCalories({ sex: 'male' }), null);
});

test('macro targets and daily target override', () => {
  const m = N.macroTargets(2000, 80, 'maintain');
  close(m.protein, 128);
  close(m.fat, 500 / 9);
  close(m.carbs, (2000 - 128 * 4 - 500) / 4);
  const settings = { sex: 'male', age: '40', heightCm: '180', weightKg: '85', activityLevel: 'moderate', goal: 'lose' };
  assert.equal(N.dailyTarget(settings).kcal, 2210);
  assert.equal(N.dailyTarget({ ...settings, calorieTarget: '1900' }).kcal, 1900);
});

test('period report, macro energy split, running total and weight rate', () => {
  const logs = [
    { date: '2026-10-09', time: '13:00', type: 'food', name: 'B', kcal: 300, protein: 20, carbs: 30, fat: 10 },
    { date: '2026-10-09', time: '08:30', type: 'food', name: 'A', kcal: 200 },
    { date: '2026-10-09', time: '10:00', type: 'exercise', name: 'Walk', kcal: 100 },
  ];
  const month = N.periodReport(logs, '2026-10-09', 30);
  assert.equal(month.days.length, 30);
  assert.equal(month.start, '2026-09-10');
  assert.equal(month.daysLogged, 1);

  const e = N.macroEnergy({ protein: 20, carbs: 30, fat: 10 });
  assert.deepEqual([e.protein, e.carbs, e.fat, e.total], [80, 120, 90, 290]);
  close(e.shares.fat, 90 / 290);

  assert.deepEqual(N.cumulativeByTime(logs).map((p) => [p.minutes, p.kcal]), [[510, 200], [780, 500]]);

  close(N.weightRate([{ date: '2026-10-01', weightKg: 86 }, { date: '2026-10-15', weightKg: 85 }]), -0.5);
  assert.equal(N.weightRate([{ date: '2026-10-01', weightKg: 86 }]), null);
});

test('real maintenance from intake and weight trend', () => {
  const settings = { sex: 'male', age: '40', heightCm: '180', weightKg: '85', activityLevel: 'moderate', goal: 'lose' };
  const logs = [];
  for (let i = 0; i < 21; i++) logs.push({ date: N.addDays('2026-10-21', -i), time: '12:00', type: 'food', name: 'x', kcal: 2000 });
  // 1 kg lost over 21 days → rate −1/3 kg/week → maintenance = 2000 + (1/21) × 7700 ≈ 2367
  const weights = [{ date: '2026-10-01', weightKg: 86 }, { date: '2026-10-21', weightKg: 85 }];
  const r = N.realMaintenance(logs, weights, settings, '2026-10-21');
  assert.equal(r.ready, true);
  close(r.maintenance, 2000 + (1 / 20) * 7700, 1);
  assert.equal(r.suggested, N.roundTo(r.maintenance - 550, 10));
  assert.equal(N.realMaintenance(logs, [weights[1]], settings, '2026-10-21').reason, 'weights');
  assert.equal(N.realMaintenance(logs.slice(0, 5), weights, settings, '2026-10-21').reason, 'logs');
});

test('streaks: current (alive if today not logged yet) and best', () => {
  const settings = { sex: 'male', age: '40', heightCm: '180', weightKg: '85', activityLevel: 'moderate', goal: 'lose', calorieTarget: '2000' };
  const day = (date, kcal, protein = 0) => ({ date, time: '12:00', type: 'food', name: 'x', kcal, protein });
  const logs = [
    day('2026-10-01', 1800), day('2026-10-02', 1900), day('2026-10-03', 2500), day('2026-10-04', 1500),
    day('2026-10-06', 1500), day('2026-10-07', 1500), day('2026-10-08', 1600),
  ];
  const s = N.streaks(logs, settings, '2026-10-09');
  assert.deepEqual(s.logging, { current: 3, best: 4 });
  assert.deepEqual(s.onTarget, { current: 3, best: 3 });
  assert.deepEqual(s.protein, { current: 0, best: 0 });
});

test('meal times and split', () => {
  assert.equal(N.mealTime('07:30').id, 'breakfast');
  assert.equal(N.mealTime('12:00').id, 'lunch');
  assert.equal(N.mealTime('16:00').id, 'afternoon');
  assert.equal(N.mealTime('19:15').id, 'dinner');
  assert.equal(N.mealTime('22:40').id, 'late');
  assert.equal(N.mealTime('01:10').id, 'late');
  assert.equal(N.mealTime('9:05').id, 'breakfast');
  const split = N.mealTimeSplit([
    { date: '2026-10-09', time: '08:00', kcal: 100 }, { date: '2026-10-09', time: '23:00', kcal: 300 },
    { date: '2026-10-09', time: '10:00', type: 'exercise', kcal: 500 }, { date: '2026-10-01', time: '08:00', kcal: 999 },
  ], '2026-10-03', '2026-10-09');
  assert.equal(split.find((r) => r.id === 'late').share, 0.75);
  assert.equal(split.find((r) => r.id === 'breakfast').count, 1);
});

test('suggestions fit the calories left, best protein per kcal first', () => {
  const s = N.suggestions(data, 400, 60);
  const names = s.fits.map((f) => f.item.name);
  assert.ok(names.includes('Chicken wrap'));          // recipe serving 345 kcal fits
  assert.ok(!names.includes('Tortilla') || s.fits.find((f) => f.item.name === 'Tortilla').n.kcal <= 400);
  assert.equal(s.fits[0].item.name, 'Chicken breast'); // 100 g: 165 kcal, 31 g protein → best ratio
  assert.ok(N.suggestions(data, 100, 0).fits.every((f) => f.n.kcal <= 100));
});

test('fasting timer and streak', () => {
  const at = (date, time, kcal = 400) => ({ date, time, type: 'food', name: 'x', kcal });
  const logs = [
    at('2026-10-06', '19:00'), at('2026-10-07', '12:00'),             // 17 h fast ending 7 Oct
    at('2026-10-07', '19:00'), at('2026-10-08', '11:30'),             // 16.5 h ending 8 Oct
    at('2026-10-08', '20:00'), at('2026-10-09', '07:00', 2),          // black coffee doesn't break it
  ];
  const now = new Date(2026, 9, 9, 10, 30);
  const f = N.fastingState(logs, 16, now);
  assert.equal(f.sinceMin, 14 * 60 + 30);
  assert.equal(f.reached, false);
  close(f.progress, 14.5 / 16);
  assert.deepEqual(f.streak, { current: 2, best: 2 });
  assert.equal(N.fastingState(logs, 16, new Date(2026, 9, 9, 12, 30)).streak.current, 3);
  assert.equal(N.fastingState([], 16, now).sinceMin, null);
});

test('exercise uses net MET', () => {
  close(N.exerciseKcal(7, 85, 60), 510);
  assert.equal(N.exerciseKcal(0.5, 85, 60), 0);
});

test('dates, daily totals, weekly report and top sources', () => {
  assert.equal(N.addDays('2026-03-01', -1), '2026-02-28');
  const logs = [
    { date: '2026-10-08', type: 'food', name: 'Chicken wrap', kcal: 345, protein: 20, carbs: 30, fat: 10 },
    { date: '2026-10-09', type: 'drink', name: 'Iced coffee', kcal: 256, protein: 6, carbs: 9, fat: 7 },
    { date: '2026-10-09', type: 'drink', name: 'iced coffee', kcal: 128, protein: 3, carbs: 4, fat: 3 },
    { date: '2026-10-09', type: 'exercise', name: 'Walking', kcal: 150 },
    { date: '2026-09-01', type: 'food', name: 'Old', kcal: 999 },
  ];
  const day = N.dayTotals(logs, '2026-10-09');
  assert.equal(day.eaten.kcal, 384);
  assert.equal(day.burned, 150);
  assert.equal(N.remainingKcal({ kcal: 2000, addExercise: false }, day), 1616);
  assert.equal(N.remainingKcal({ kcal: 2000, addExercise: true }, day), 1766);

  const week = N.weeklyReport(logs, '2026-10-09');
  assert.equal(week.days.length, 7);
  assert.equal(week.start, '2026-10-03');
  assert.equal(week.daysLogged, 2);
  assert.equal(week.total.kcal, 729);
  close(week.average.kcal, 364.5);

  const top = N.topSources(logs, '2026-10-03', '2026-10-09');
  assert.equal(top[0].name, 'Iced coffee');
  assert.equal(top[0].kcal, 384);
  assert.equal(top[0].count, 2);
  close(top[0].share, 384 / 729);
});
