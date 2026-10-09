// Our Fridge (foods) and Our Bar (drinks): list, add, edit, delete.
import * as N from '../nutrition.js';
import { esc, fmt0, fmt1, kcal, kj, macroLine, sourceBadge, openSheet, saveInBackground, seg, segValue, wireSegs, icon } from '../ui.js';
import { ingredientEditor, previewTotals } from './ingredients.js';
import { openLogSheet } from './log.js';

const CONFIG = {
  food: { table: 'foods', title: 'Our Fridge', eyebrow: 'Saved foods', noun: 'food', defaultUnit: 'g' },
  drink: { table: 'drinks', title: 'Our Bar', eyebrow: 'Saved drinks', noun: 'drink', defaultUnit: 'ml' },
};

export function render(el, app, type) {
  const cfg = CONFIG[type];
  const items = [...app.data[cfg.table]].sort((a, b) => a.name.localeCompare(b.name));

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${cfg.eyebrow}</p><h1>${cfg.title}</h1></div>
      <button class="icon-btn" id="add" aria-label="Add ${cfg.noun}">${icon.plus}</button>
    </header>
    ${items.length > 5 ? `<label class="search" style="display:block;margin-bottom:14px">${icon.search}<input class="input glass" type="search" id="q" placeholder="Search ${cfg.title}"></label>` : ''}
    <section class="card glass">
      ${items.length ? '<ul class="list" id="list"></ul>' : `<div class="empty"><p>No ${cfg.noun}s saved yet.</p><button class="btn" id="add2">${icon.plus} Add a ${cfg.noun}</button></div>`}
    </section>`;

  const listEl = el.querySelector('#list');
  const draw = (term = '') => {
    if (!listEl) return;
    const shown = items.filter((i) => i.name.toLowerCase().includes(term.toLowerCase()));
    listEl.innerHTML = shown.map((item) => {
      const p = N.displayPortion(app.data, type, item);
      const composite = N.isComposite(app.data, type, item);
      const ingCount = N.ingredientsOf(app.data, 'drink', item.id).length;
      return `<li class="tap" data-id="${esc(item.id)}">
        <div class="grow">
          <div class="title">${esc(item.name)}</div>
          <div class="sub num">${composite ? `${ingCount} ingredient${ingCount === 1 ? '' : 's'} · ` : ''}${macroLine(p)}</div>
          <div class="sub" style="margin-top:3px">${sourceBadge(p.source)}</div>
        </div>
        <div class="value num">${fmt0(p.kcal)} kcal<small>per ${esc(p.label)}</small></div>
      </li>`;
    }).join('') || '<li class="empty" style="display:block">No matches.</li>';
    listEl.querySelectorAll('li[data-id]').forEach((li) => {
      li.onclick = () => openItemForm(app, type, items.find((i) => i.id === li.dataset.id));
    });
  };
  draw();

  const q = el.querySelector('#q');
  if (q) q.oninput = () => draw(q.value);
  el.querySelector('#add').onclick = () => openItemForm(app, type);
  el.querySelector('#add2')?.addEventListener('click', () => openItemForm(app, type));

  // Coming from "Add to Fridge/Bar" in the log sheet.
  if (app.state.addName) {
    const name = app.state.addName.trim();
    app.state.addName = null;
    openItemForm(app, type, null, name);
  }
}

/** Add or edit a food/drink. `onSaved(savedRow)` runs once the save is confirmed (used by the meal form). */
export function openItemForm(app, type, item = null, presetName = '', onSaved = null) {
  const cfg = CONFIG[type];
  const isNew = !item;
  const v = item || { name: presetName, unit: cfg.defaultUnit, servingSize: '', kcal: '', protein: '', carbs: '', fat: '', source: 'label', notes: '' };
  const existingIngs = item ? N.ingredientsOf(app.data, 'drink', item.id) : [];
  let composite = type === 'drink' && existingIngs.length > 0;

  openSheet(isNew ? `New ${cfg.noun}` : `Edit ${cfg.noun}`, (body, close) => {
    body.innerHTML = `
      <label class="field"><span>Name</span><input class="input" id="name" value="${esc(v.name)}" placeholder="e.g. ${type === 'food' ? 'Greek yoghurt' : 'Iced coffee'}" autocomplete="off"></label>
      ${type === 'drink' ? `<label class="toggle"><span><b>Made from ingredients</b><br><span class="small muted">e.g. coffee with milk and syrup</span></span>
        <span class="switch"><input type="checkbox" id="composite" ${composite ? 'checked' : ''}><span></span></span></label>` : ''}

      <div id="simple">
        <div class="stack">
          ${seg('unit', [['g', 'Per 100 g'], ['ml', 'Per 100 ml'], ['serving', 'Per serving']], v.unit || cfg.defaultUnit)}
          <div class="small muted" id="per-label"></div>
          <div class="grid-2">
            <label class="field"><span>Energy (kcal)</span><input class="input num" id="kcal" inputmode="decimal" value="${esc(v.kcal)}"></label>
            <label class="field"><span>Protein (g)</span><input class="input num" id="protein" inputmode="decimal" value="${esc(v.protein)}"></label>
            <label class="field"><span>Carbs (g)</span><input class="input num" id="carbs" inputmode="decimal" value="${esc(v.carbs)}"></label>
            <label class="field"><span>Fat (g)</span><input class="input num" id="fat" inputmode="decimal" value="${esc(v.fat)}"></label>
          </div>
          <div class="row"><span class="small muted grow num" id="kj"></span>
            <button type="button" class="btn ghost small" id="from-macros">Work out kcal from macros</button></div>
          <div><div class="small muted" style="margin:0 0 6px 4px;font-weight:600">Where are these values from?</div>
            ${seg('source', [['label', 'Product label'], ['estimated', 'Estimate']], v.source === 'label' ? 'label' : 'estimated')}</div>
        </div>
      </div>

      <div id="composite-box">
        <div class="small muted" style="font-weight:600;margin:0 0 6px 4px">Ingredients for one drink</div>
        <div id="ings"></div>
      </div>

      <label class="field"><span id="serving-label"></span><input class="input num" id="serving" inputmode="decimal" value="${esc(v.servingSize)}" placeholder="Optional"></label>
      <div class="preview" id="preview"></div>
      <label class="field"><span>Notes</span><textarea class="input" id="notes" placeholder="Optional">${esc(v.notes)}</textarea></label>

      <div class="sheet-actions"><button class="btn" id="save">Save</button>
        ${isNew ? '' : '<button class="btn secondary" id="log">Log it</button>'}</div>
      ${isNew ? '' : `<button class="btn danger block small" id="delete">${icon.trash} Delete ${cfg.noun}</button>`}`;

    const $ = (id) => body.querySelector(`#${id}`);
    const unit = () => segValue(body, 'unit') || cfg.defaultUnit;

    const editor = type === 'drink'
      ? ingredientEditor($('ings'), app, existingIngs, { exclude: item ? { type: 'drink', id: item.id } : null, onChange: draw })
      : null;

    function values() {
      return {
        name: $('name').value.trim(),
        unit: composite ? 'ml' : unit(),
        servingSize: !composite && unit() === 'serving' ? '' : $('serving').value.trim() === '' ? '' : N.num($('serving').value),
        kcal: composite ? '' : $('kcal').value.trim() === '' ? '' : N.num($('kcal').value),
        protein: composite ? '' : N.num($('protein').value),
        carbs: composite ? '' : N.num($('carbs').value),
        fat: composite ? '' : N.num($('fat').value),
        source: composite ? 'estimated' : segValue(body, 'source'),
        notes: $('notes').value.trim(),
      };
    }

    function draw() {
      $('simple').classList.toggle('hidden', composite);
      $('composite-box').classList.toggle('hidden', !composite);
      const perServing = !composite && unit() === 'serving';
      const per = perServing ? 'serving' : `100 ${unit()}`;
      $('serving-label').textContent = composite ? 'Volume of one drink (ml)' : `Serving size (${unit()})`;
      $('serving').closest('.field').classList.toggle('hidden', perServing);
      $('per-label').textContent = `Nutrition per ${per}`;
      $('kj').textContent = $('kcal').value ? `= ${kj(N.num($('kcal').value))} per ${per}` : '';

      if (composite) {
        const t = previewTotals(app, editor.get());
        $('preview').innerHTML = `<div class="row"><div class="grow"><div class="small muted">One drink</div>
          <div class="big num">${kcal(t.kcal)}</div><div class="small muted num">${kj(t.kcal)} · ${macroLine(t)}</div></div>${sourceBadge(t.source)}</div>`;
        return;
      }
      const s = N.num($('serving').value);
      const vals = values();
      if (!perServing && s > 0 && vals.kcal !== '') {
        const n = N.scale(vals, s / 100);
        $('preview').innerHTML = `<div class="small muted">Per serving (${fmt1(s)} ${unit()})</div>
          <div class="big num">${kcal(n.kcal)}</div><div class="small muted num">${kj(n.kcal)} · ${macroLine(n)}</div>`;
        $('preview').classList.remove('hidden');
      } else {
        $('preview').classList.add('hidden');
      }
    }

    wireSegs(body, draw);
    ['kcal', 'protein', 'carbs', 'fat', 'serving'].forEach((id) => ($(id).oninput = draw));
    $('composite')?.addEventListener('change', (e) => { composite = e.target.checked; draw(); });
    $('from-macros').onclick = () => {
      const k = N.kcalFromMacros({ protein: $('protein').value, carbs: $('carbs').value, fat: $('fat').value });
      $('kcal').value = Math.round(k);
      // Calculated values are estimates.
      body.querySelectorAll('[data-seg="source"] button').forEach((b) => b.classList.toggle('active', b.dataset.value === 'estimated'));
      draw();
    };
    draw();
    if (isNew && !v.name) $('name').focus();

    $('save').onclick = () => {
      const vals = values();
      if (!vals.name) return $('name').focus();
      if (!composite && vals.kcal === '') return $('kcal').focus();
      const ings = editor?.get() || [];
      if (composite && !ings.length) return alert('Add at least one ingredient, or switch off “Made from ingredients”.');

      close();
      saveInBackground(app, () => {
        if (type === 'drink') return app.store.saveWithIngredients(cfg.table, item?.id || null, vals, 'drink', composite ? ings : []);
        return isNew ? app.store.add(cfg.table, vals) : app.store.update(cfg.table, item.id, vals);
      }, `Saved ${vals.name}`, onSaved);
    };

    $('log')?.addEventListener('click', () => { close(); setTimeout(() => openLogSheet(app, { type, item }), 320); });

    $('delete')?.addEventListener('click', () => {
      const usedIn = app.data.ingredients.filter((i) => i.itemType === type && i.itemId === item.id).length;
      const warn = usedIn ? `\n\nIt is used as an ingredient ${usedIn} time${usedIn === 1 ? '' : 's'}; those recipes/drinks will show it as missing.` : '';
      if (!confirm(`Delete ${item.name}?${warn}\n\nYour past log entries are kept.`)) return;
      close();
      saveInBackground(app, () => app.store.remove(cfg.table, item.id), `Deleted ${item.name}`);
    });
  });
}
