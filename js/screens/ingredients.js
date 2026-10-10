// Editable list of ingredients (used by Cookbook recipes and Bar drinks).
import * as N from '../nutrition.js';
import { esc, icon } from '../ui.js';

/**
 * Render an ingredient editor into `el`.
 * `rows` = [{ itemType, itemId, quantity, unit }]. `exclude` = { type, id } to leave out (the item itself).
 * Returns { get(): rows } and calls onChange() on every edit.
 */
export function ingredientEditor(el, app, rows, { exclude = null, onChange = () => {}, addLabel = 'Add ingredient', drinkFirst = false } = {}) {
  const { foods, drinks } = app.data;
  const options = [
    ...foods.map((f) => ({ key: `food:${f.id}`, type: 'food', item: f })),
    ...drinks.filter((d) => !(exclude?.type === 'drink' && exclude.id === d.id)).map((d) => ({ key: `drink:${d.id}`, type: 'drink', item: d })),
  ];
  const byKey = new Map(options.map((o) => [o.key, o]));
  let list = rows.map((r) => ({ ...r }));

  // With drinkFirst, items already used in drinks (milk, espresso, syrups…) are listed first.
  const inDrinks = new Set(drinkFirst
    ? (app.data.ingredients || []).filter((i) => i.parentType === 'drink').map((i) => `${i.itemType}:${i.itemId}`)
    : []);
  const groups = [
    ['Drink ingredients', (o) => inDrinks.has(o.key)],
    ['Our Fridge', (o) => o.type === 'food' && !inDrinks.has(o.key)],
    ['Our Bar', (o) => o.type === 'drink' && !inDrinks.has(o.key)],
  ];
  const byName = (a, b) => a.item.name.localeCompare(b.item.name);
  // Every word typed must appear in the name ("milk free" finds "Fat-free milk").
  const matches = (o, words) => words.every((w) => o.item.name.toLowerCase().includes(w));

  const unitsFor = (key) => {
    const o = byKey.get(key);
    return o ? N.unitsFor(app.data, o.type, o.item) : ['g'];
  };

  // Index of the row whose search picker is open; a new, empty list starts with it open.
  let picking = list.length && list.every((r) => !r.itemId) ? 0 : -1;
  let focusSearch = false;

  function pickerResults(query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const html = groups.map(([label, test]) => {
      const found = options.filter((o) => test(o) && matches(o, words)).sort(byName);
      return found.length ? `<div class="pick-group">${label}</div>${found.map((o) =>
        `<button type="button" class="pick-item" data-key="${esc(o.key)}">${esc(o.item.name)}</button>`).join('')}` : '';
    }).join('');
    return html || '<p class="small muted pick-empty">Nothing found. Use “New food” or “New drink” to add it.</p>';
  }

  function draw() {
    if (!options.length) {
      el.innerHTML = '<p class="small muted">Add items to Our Fridge or Our Bar first, then use them as ingredients.</p>';
      return;
    }
    el.innerHTML = `
      <div class="stack">
        ${list.map((r, i) => {
          const key = r.itemId ? `${r.itemType}:${r.itemId}` : '';
          const name = key ? (byKey.get(key)?.item.name ?? '(deleted item)') : '';
          return `<div class="ing-row" data-i="${i}">
            <button type="button" class="input pick ${name ? '' : 'empty'}" data-f="item" aria-expanded="${i === picking}">${name ? esc(name) : `${icon.search} Search…`}</button>
            <input class="input num" data-f="quantity" inputmode="decimal" value="${esc(r.quantity)}" placeholder="Qty">
            <select class="input" data-f="unit">${unitsFor(key).map((u) => `<option ${u === r.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
            <button type="button" class="icon-btn plain" data-remove aria-label="Remove ingredient">${icon.close}</button>
          </div>${i === picking ? `
          <div class="picker">
            <label class="search">${icon.search}<input class="input" data-search type="search" placeholder="Search ingredients" autocomplete="off" enterkeyhint="search"></label>
            <div class="pick-list">${pickerResults('')}</div>
          </div>` : ''}`;
        }).join('')}
      </div>
      <button type="button" class="btn ghost small" data-add style="margin-top:10px">${icon.plus} ${esc(addLabel)}</button>`;

    el.querySelectorAll('.ing-row').forEach((row) => {
      const i = Number(row.dataset.i);
      const r = list[i];
      row.querySelector('[data-f="item"]').onclick = () => { picking = picking === i ? -1 : i; focusSearch = true; draw(); };
      row.querySelector('[data-f="quantity"]').oninput = (e) => { r.quantity = e.target.value; onChange(); };
      row.querySelector('[data-f="unit"]').onchange = (e) => { r.unit = e.target.value; onChange(); };
      row.querySelector('[data-remove]').onclick = () => { list.splice(i, 1); picking = -1; draw(); onChange(); };
    });

    const picker = el.querySelector('.picker');
    if (picker) {
      const r = list[picking];
      const search = picker.querySelector('[data-search]');
      const results = picker.querySelector('.pick-list');
      search.oninput = () => { results.innerHTML = pickerResults(search.value); };
      results.onclick = (e) => {
        const b = e.target.closest('.pick-item');
        if (!b) return;
        const [type, id] = b.dataset.key.split(':');
        r.itemType = type; r.itemId = id;
        const units = unitsFor(b.dataset.key);
        if (!units.includes(r.unit)) r.unit = units[0];
        const done = picking;
        picking = -1;
        draw(); onChange();
        el.querySelector(`.ing-row[data-i="${done}"] [data-f="quantity"]`)?.focus();
      };
      // Only focus (and pop up the keyboard) after a tap, not when the sheet first opens.
      if (focusSearch) {
        search.focus({ preventScroll: true });
        picker.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
    el.querySelector('[data-add]').onclick = () => {
      list.push({ itemType: '', itemId: '', quantity: '', unit: 'g' });
      picking = list.length - 1;
      focusSearch = true;
      draw();
    };
  }
  draw();

  return {
    // Only complete rows count.
    get: () => list.filter((r) => r.itemId && N.num(r.quantity) > 0).map((r) => ({ ...r, quantity: N.num(r.quantity) })),
  };
}

/** Nutrition of an unsaved ingredient list (for live previews). */
export function previewTotals(app, rows) {
  const tempId = '__preview__';
  const data = { ...app.data, ingredients: rows.map((r) => ({ ...r, parentType: 'recipe', parentId: tempId })) };
  return N.compositeTotals(data, 'recipe', tempId);
}
