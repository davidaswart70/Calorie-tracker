import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBackend } from './helpers/apps-script-mock.js';

const TABS = ['Foods', 'Drinks', 'Recipes', 'Recipe Ingredients', 'Daily Logs', 'Weight Logs', 'Settings'];

function backend() {
  const b = loadBackend({ passcode: 'pw' });
  const call = (action, params = {}) => b.post({ passcode: 'pw', action, ...params });
  return { ...b, call };
}

test('passcode is required', () => {
  const b = backend();
  assert.deepEqual(b.post({ passcode: 'nope', action: 'load' }), { ok: false, error: 'Wrong passcode.' });
  b.props.PASSCODE = null;
  assert.match(b.post({ passcode: '', action: 'load' }).error, /No PASSCODE/);
});

test('load creates all tabs with headers and returns empty data', () => {
  const b = backend();
  const res = b.call('load');
  assert.equal(res.ok, true);
  assert.deepEqual([...b.ss.sheets.keys()], TABS);
  assert.deepEqual(b.ss.getSheetByName('Foods').rows[0].slice(0, 3), ['id', 'name', 'unit']);
  assert.deepEqual(res.data.foods, []);
  assert.deepEqual(res.data.settings, {});
});

test('add returns the row read back from the sheet, plus all data', () => {
  const b = backend();
  const res = b.call('add', { table: 'foods', row: { name: 'Yoghurt', unit: 'g', kcal: 75, protein: 9, source: 'label', bogus: 'x' } });
  assert.equal(res.ok, true);
  assert.equal(res.row.name, 'Yoghurt');
  assert.equal(res.row.kcal, '75');
  assert.ok(res.row.id && res.row.updatedAt);
  assert.equal(res.row.bogus, undefined);
  assert.equal(res.data.foods.length, 1);
});

test('update and remove', () => {
  const b = backend();
  const { row } = b.call('add', { table: 'foods', row: { name: 'Milk', kcal: 64 } });
  const up = b.call('update', { table: 'foods', id: row.id, row: { kcal: 50 } });
  assert.equal(up.row.kcal, '50');
  assert.equal(up.row.name, 'Milk');
  assert.equal(b.call('remove', { table: 'foods', id: row.id }).data.foods.length, 0);
  assert.equal(b.call('update', { table: 'foods', id: row.id, row: { kcal: 1 } }).ok, false);
  assert.equal(b.call('add', { table: 'nope', row: {} }).ok, false);
});

test('saveWithIngredients replaces ingredients; deleting the parent removes them', () => {
  const b = backend();
  const milk = b.call('add', { table: 'foods', row: { name: 'Milk' } }).row;
  const ing = (q) => ({ itemType: 'food', itemId: milk.id, quantity: q, unit: 'ml' });
  const first = b.call('saveWithIngredients', { table: 'drinks', id: null, row: { name: 'Iced coffee' }, parentType: 'drink', list: [ing(200), ing(50)] });
  assert.equal(first.data.ingredients.length, 2);
  const id = first.row.id;
  const second = b.call('saveWithIngredients', { table: 'drinks', id, row: { name: 'Iced coffee' }, parentType: 'drink', list: [ing(150)] });
  assert.equal(second.data.drinks.length, 1);
  assert.deepEqual(second.data.ingredients.map((i) => [i.parentId, i.quantity]), [[id, '150']]);
  assert.equal(b.call('remove', { table: 'drinks', id }).data.ingredients.length, 0);
});

test('saveWeight keeps one entry per date', () => {
  const b = backend();
  b.call('saveWeight', { date: '2026-10-09', weightKg: 85 });
  const res = b.call('saveWeight', { date: '2026-10-09', weightKg: 84.6 });
  assert.deepEqual(res.data.weights.map((w) => [w.date, w.weightKg]), [['2026-10-09', '84.6']]);
});

test('saveSettings inserts and updates keys', () => {
  const b = backend();
  b.call('saveSettings', { values: { sex: 'male', age: 40 } });
  const res = b.call('saveSettings', { values: { age: 41, goal: 'lose' } });
  assert.deepEqual(res.data.settings, { sex: 'male', age: '41', goal: 'lose' });
});

test('columns are matched by header name, and Date cells come back as yyyy-mm-dd', () => {
  const b = backend();
  b.call('load');
  const sh = b.ss.getSheetByName('Weight Logs');
  sh.rows[0] = ['date', 'weightKg', 'id', 'createdAt'];
  sh.rows.push([new Date('2026-10-01T00:00:00Z'), 80, 'w1', '']);
  const res = b.call('load');
  assert.deepEqual(res.data.weights, [{ id: 'w1', date: '2026-10-01', weightKg: 80, createdAt: '' }]);
});

test('doGet confirms the web app is running', () => {
  assert.equal(backend().get().ok, true);
});
