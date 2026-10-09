import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mondayOf, lastWeekStart, weekWrapped } from '../js/wrapped.js';

test('week boundaries', () => {
  assert.equal(mondayOf('2026-10-09'), '2026-10-05'); // Friday → Monday
  assert.equal(mondayOf('2026-10-11'), '2026-10-05'); // Sunday
  assert.equal(lastWeekStart('2026-10-09'), '2026-09-28');
});

test('wrapped slides from the week’s data', () => {
  const data = {
    settings: { calorieTarget: '2000' },
    foods: [], recipes: [], ingredients: [],
    drinks: [{ id: 'c', name: 'Black iced coffee', unit: 'serving' }],
    weights: [{ date: '2026-09-27', weightKg: '87' }, { date: '2026-10-04', weightKg: '86.2' }],
    logs: [
      { date: '2026-09-28', time: '12:00', type: 'recipe', name: 'Chicken & Avocado Wrap', kcal: 552, protein: 56 },
      { date: '2026-09-29', time: '12:00', type: 'recipe', name: 'Chicken & Avocado Wrap', kcal: 552, protein: 56 },
      { date: '2026-09-29', time: '23:00', type: 'food', name: 'Ham', kcal: 300, protein: 30 },
      { date: '2026-09-30', time: '08:00', type: 'drink', itemId: 'c', name: 'Black iced coffee', quantity: 2, unit: 'serving', kcal: 4 },
      { date: '2026-09-30', time: '17:00', type: 'exercise', name: 'Walk', kcal: 300 },
      { date: '2026-10-08', time: '12:00', type: 'food', name: 'Outside the week', kcal: 9999 },
    ],
  };
  const slides = weekWrapped(data, '2026-09-28');
  const by = Object.fromEntries(slides.map((s) => [s.id, s]));
  assert.equal(by.intro.sub, '3 days logged · 4 entries');
  assert.equal(by.total.big, '1,408 kcal');
  assert.equal(by.target.big, '3 of 3 days');
  assert.equal(by.favourite.big, 'Chicken & Avocado Wrap');
  assert.equal(by.coffee.big, '2 coffees');
  assert.equal(by.exercise.big, '300 kcal');
  assert.equal(by.weight.big, '−0.8 kg');
  assert.equal(slides.at(-1).id, 'outro');
  assert.equal(weekWrapped(data, '2026-09-14'), null);
});
