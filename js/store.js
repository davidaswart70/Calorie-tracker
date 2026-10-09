// Data storage.
//
// For now everything is saved in this browser's localStorage.
// The tables mirror the planned Google Sheets tabs, and every function is async,
// so this file can later be swapped for a Google Sheets version without changing the screens.

const KEY = 'calorie-tracker-data-v1';

// Table name → columns (the future Google Sheets tab headers).
export const SCHEMA = {
  foods: ['id', 'name', 'unit', 'servingSize', 'kcal', 'protein', 'carbs', 'fat', 'source', 'notes', 'updatedAt'],
  drinks: ['id', 'name', 'unit', 'servingSize', 'kcal', 'protein', 'carbs', 'fat', 'source', 'notes', 'updatedAt'],
  recipes: ['id', 'name', 'servings', 'notes', 'updatedAt'],
  ingredients: ['id', 'parentType', 'parentId', 'itemType', 'itemId', 'quantity', 'unit'],
  logs: ['id', 'date', 'time', 'type', 'itemId', 'name', 'quantity', 'unit', 'kcal', 'protein', 'carbs', 'fat', 'source', 'createdAt'],
  weights: ['id', 'date', 'weightKg', 'createdAt'],
};

function empty() {
  const data = { settings: {} };
  for (const t of Object.keys(SCHEMA)) data[t] = [];
  return data;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    throw new Error('Could not save to this device’s storage. Nothing was saved.');
  }
  // Read back to confirm the write really happened.
  if (localStorage.getItem(KEY) !== JSON.stringify(data)) {
    throw new Error('Save could not be confirmed. Nothing was saved.');
  }
}

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).slice(0, 13);

function clean(table, row) {
  const out = {};
  for (const col of SCHEMA[table]) if (col in row) out[col] = row[col] ?? '';
  return out;
}

function check(table) {
  if (!SCHEMA[table]) throw new Error(`Unknown table: ${table}`);
}

/** Load everything. */
export async function load() {
  return read();
}

/** Add a row; returns the saved row (with id). */
export async function add(table, row) {
  check(table);
  const data = read();
  const saved = { ...clean(table, row), id: newId() };
  if (SCHEMA[table].includes('updatedAt')) saved.updatedAt = new Date().toISOString();
  if (SCHEMA[table].includes('createdAt')) saved.createdAt = new Date().toISOString();
  data[table].push(saved);
  write(data);
  return saved;
}

/** Update a row by id; returns the saved row. */
export async function update(table, id, changes) {
  check(table);
  const data = read();
  const i = data[table].findIndex((r) => r.id === id);
  if (i < 0) throw new Error('That item no longer exists.');
  const saved = { ...data[table][i], ...clean(table, changes), id };
  if (SCHEMA[table].includes('updatedAt')) saved.updatedAt = new Date().toISOString();
  data[table][i] = saved;
  write(data);
  return saved;
}

/** Delete a row by id (also removes ingredients belonging to a recipe/drink). */
export async function remove(table, id) {
  check(table);
  const data = read();
  data[table] = data[table].filter((r) => r.id !== id);
  if (table === 'recipes' || table === 'drinks') {
    const type = table === 'recipes' ? 'recipe' : 'drink';
    data.ingredients = data.ingredients.filter((i) => !(i.parentType === type && i.parentId === id));
  }
  write(data);
}

/** Replace all ingredients of a recipe or drink. */
export async function setIngredients(parentType, parentId, list) {
  const data = read();
  data.ingredients = data.ingredients.filter((i) => !(i.parentType === parentType && i.parentId === parentId));
  for (const ing of list) {
    data.ingredients.push({ ...clean('ingredients', ing), id: newId(), parentType, parentId });
  }
  write(data);
}

/** Save a weight; replaces any existing entry for the same date. */
export async function saveWeight(date, weightKg) {
  const existing = read().weights.find((w) => w.date === date);
  return existing ? update('weights', existing.id, { weightKg }) : add('weights', { date, weightKg });
}

/** Merge key/value pairs into settings. */
export async function saveSettings(values) {
  const data = read();
  data.settings = { ...data.settings };
  for (const [k, v] of Object.entries(values)) data.settings[k] = v == null ? '' : String(v);
  write(data);
  return data.settings;
}
