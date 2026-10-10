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
  const group = (label, list, selected) => (list.length ? `<optgroup label="${label}">${list.map((o) => opt(o, selected)).join('')}</optgroup>` : '');
  const optionHtml = (selected) => `
    <option value="">Choose…</option>
    ${group('Drink ingredients', options.filter((o) => inDrinks.has(o.key)), selected)}
    ${group('Our Fridge', options.filter((o) => o.type === 'food' && !inDrinks.has(o.key)), selected)}
    ${group('Our Bar', options.filter((o) => o.type === 'drink' && !inDrinks.has(o.key)), selected)}`;
  const opt = (o, selected) => `<option value="${esc(o.key)}" ${o.key === selected ? 'selected' : ''}>${esc(o.item.name)}</option>`;

  const unitsFor = (key) => {
    const o = byKey.get(key);
    return o ? N.unitsFor(app.data, o.type, o.item) : ['g'];
  };

  function draw() {
    if (!options.length) {
      el.innerHTML = '<p class="small muted">Add items to Our Fridge or Our Bar first, then use them as ingredients.</p>';
      return;
    }
    el.innerHTML = `
      <div class="stack">
        ${list.map((r, i) => {
          const key = r.itemId ? `${r.itemType}:${r.itemId}` : '';
          const missing = key && !byKey.has(key);
          return `<div class="ing-row" data-i="${i}">
            <select class="input" data-f="item">${missing ? '<option value="" selected>(deleted item)</option>' : ''}${optionHtml(key)}</select>
            <input class="input num" data-f="quantity" inputmode="decimal" value="${esc(r.quantity)}" placeholder="Qty">
            <select class="input" data-f="unit">${unitsFor(key).map((u) => `<option ${u === r.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
            <button type="button" class="icon-btn plain" data-remove aria-label="Remove ingredient">${icon.close}</button>
          </div>`;
        }).join('')}
      </div>
      <button type="button" class="btn ghost small" data-add style="margin-top:10px">${icon.plus} ${esc(addLabel)}</button>`;

    el.querySelectorAll('.ing-row').forEach((row) => {
      const r = list[row.dataset.i];
      row.querySelector('[data-f="item"]').onchange = (e) => {
        const [type, id] = e.target.value.split(':');
        r.itemType = type; r.itemId = id;
        const units = unitsFor(e.target.value);
        if (!units.includes(r.unit)) r.unit = units[0];
        draw(); onChange();
      };
      row.querySelector('[data-f="quantity"]').oninput = (e) => { r.quantity = e.target.value; onChange(); };
      row.querySelector('[data-f="unit"]').onchange = (e) => { r.unit = e.target.value; onChange(); };
      row.querySelector('[data-remove]').onclick = () => { list.splice(row.dataset.i, 1); draw(); onChange(); };
    });
    el.querySelector('[data-add]').onclick = () => { list.push({ itemType: '', itemId: '', quantity: '', unit: 'g' }); draw(); };
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
