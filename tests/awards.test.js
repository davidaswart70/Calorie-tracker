import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumption, evaluateAwards } from '../js/awards.js';

const data = () => ({
  settings: {},
  foods: [
    { id: 'chk', name: 'Cooked chicken breast', unit: 'g', servingSize: '' },
    { id: 'avo', name: 'Hass avocado', unit: 'g', servingSize: '' },
    { id: 'ham', name: 'Smoked ham (sliced)', unit: 'g', servingSize: '23' },
    { id: 'milk', name: 'Fat-free milk', unit: 'ml', servingSize: '250' },
    { id: 'syr', name: 'Flavoured syrup', unit: 'ml', servingSize: '5' },
    { id: 'beef', name: 'Beef mince', unit: 'g', servingSize: '' },
  ],
  drinks: [
    { id: 'esp', name: 'Espresso', unit: 'serving' },
    { id: 'ic', name: 'Salted caramel iced coffee', unit: 'ml', servingSize: '' },
  ],
  recipes: [{ id: 'wrap', name: 'Chicken & Avocado Wrap', servings: '1' }],
  ingredients: [
    { parentType: 'recipe', parentId: 'wrap', itemType: 'food', itemId: 'chk', quantity: '151', unit: 'g' },
    { parentType: 'recipe', parentId: 'wrap', itemType: 'food', itemId: 'avo', quantity: '53', unit: 'g' },
    { parentType: 'drink', parentId: 'ic', itemType: 'food', itemId: 'milk', quantity: '150', unit: 'ml' },
    { parentType: 'drink', parentId: 'ic', itemType: 'drink', itemId: 'esp', quantity: '1', unit: 'serving' },
    { parentType: 'drink', parentId: 'ic', itemType: 'food', itemId: 'syr', quantity: '5', unit: 'ml' },
  ],
  weights: [],
  logs: [
    { date: '2026-10-09', time: '12:00', type: 'recipe', itemId: 'wrap', name: 'Chicken & Avocado Wrap', quantity: '2', unit: 'serving', kcal: 1104, protein: 112 },
    { date: '2026-10-09', time: '08:00', type: 'drink', itemId: 'ic', name: 'Salted caramel iced coffee', quantity: '2', unit: 'serving', kcal: 104 },
    { date: '2026-10-09', time: '23:15', type: 'drink', itemId: 'esp', name: 'Espresso', quantity: '1', unit: 'serving', kcal: 2 },
    { date: '2026-10-09', time: '13:00', type: 'meal', itemId: '', name: 'Lunch: 2 × Smoked ham (sliced), 70 g Hass avocado', quantity: '1', unit: 'meal', kcal: 157 },
    { date: '2026-10-09', time: '19:00', type: 'food', itemId: 'beef', name: 'Beef mince', quantity: '55000', unit: 'g', kcal: 1 },
  ],
});

test('consumption expands recipes, drinks made from ingredients and meals', () => {
  const c = consumption(data());
  assert.equal(c.get('food:chk').amount, 302);
  assert.equal(c.get('food:avo').amount, 106 + 70);
  assert.equal(c.get('food:ham').amount, 46);
  assert.equal(c.get('food:milk').amount, 300);
  assert.equal(c.get('drink:ic').servings, 2);
  assert.equal(c.get('drink:esp').servings, 3); // 2 inside iced coffees + 1 on its own
  assert.equal(c.get('drink:esp').direct, 1);
});

test('awards: silly and serious ones', () => {
  const a = Object.fromEntries(evaluateAwards(data(), '2026-10-09').map((b) => [b.id, b]));
  assert.equal(a['beef-55'].earned, true);           // a quarter of a cow
  assert.equal(a['beef-220'].earned, false);
  assert.equal(a['chicken-1'].value.toFixed(3), (302 / 350).toFixed(3));
  assert.equal(a['coffee-10'].value, 3);              // 2 iced coffees + 1 espresso, shots not double-counted
  assert.equal(a['night-1'].earned, true);
  assert.equal(a['entries-1'].earned, true);
  assert.equal(a['streak-3'].value, 1);
  assert.equal(a['avo-10'].value, 176 / 170);         // "Flavoured syrup" is not an avocado
  assert.match(a['beef-220'].progressText, /kg beef of/);
});
