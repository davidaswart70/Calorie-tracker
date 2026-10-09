// Log a one-off meal made of several Fridge/Bar items, optionally saving it as a recipe.
import * as N from '../nutrition.js';
import { esc, fmt1, kcal, kj, macroLine, sourceBadge, openSheet, saveInBackground, icon } from '../ui.js';
import { ingredientEditor, previewTotals } from './ingredients.js';
import { openItemForm } from './items.js';

const round1 = (v) => Math.round(v * 10) / 10;
const nowTime = () => new Date().toTimeString().slice(0, 5);

/** e.g. "2 × Smoked ham, 70 g Hass avocado" */
function describe(app, rows) {
  return rows.map((r) => {
    const item = N.findItem(app.data, r.itemType, r.itemId);
    const name = item ? item.name : '(deleted item)';
    return r.unit === 'serving' ? `${fmt1(r.quantity)} × ${name}` : `${fmt1(r.quantity)} ${r.unit} ${name}`;
  }).join(', ');
}

export function openMealSheet(app, date = N.dateStr()) {
  // A draft survives a detour to add a new food (or closing the "new food" form).
  const resumed = Boolean(app.state.mealDraft);
  const draft = app.state.mealDraft || { name: '', date, rows: [], saveRecipe: false };

  openSheet('Log a meal', (body, close) => {
    body.innerHTML = `
      ${resumed ? `<div class="notice ok row"><span class="grow">Continuing your unsaved meal.</span>
        <button type="button" class="btn ghost small" id="restart">Start over</button></div>` : ''}
      <div class="grid-2">
        <label class="field"><span>Name (optional)</span><input class="input" id="name" placeholder="e.g. Lunch" value="${esc(draft.name)}" autocomplete="off"></label>
        <label class="field"><span>Date</span><input class="input" id="date" type="date" value="${esc(draft.date)}"></label>
      </div>
      <div>
        <div class="small muted" style="font-weight:600;margin:0 0 6px 4px">What did you have?</div>
        <div id="ings"></div>
        <div class="grid-2" style="margin-top:10px">
          <button type="button" class="btn ghost small" id="new-food">${icon.plus} New food</button>
          <button type="button" class="btn ghost small" id="new-drink">${icon.plus} New drink</button>
        </div>
      </div>
      <div class="preview" id="preview"></div>
      <label class="toggle"><span><b>Also save as a recipe</b><br>
        <span class="small muted">Adds it to Our Cookbook so you can log it again in one tap.</span></span>
        <span class="switch"><input type="checkbox" id="recipe" ${draft.saveRecipe ? 'checked' : ''}><span></span></span></label>
      <div class="sheet-actions"><button class="btn block" id="log">Log meal</button></div>`;

    const $ = (id) => body.querySelector(`#${id}`);
    const start = draft.rows.length ? draft.rows : [{ itemType: '', itemId: '', quantity: '', unit: 'g' }];
    const editor = ingredientEditor($('ings'), app, start, { onChange: draw, addLabel: 'Add item' });

    function current() {
      return { name: $('name').value.trim(), date: $('date').value || N.dateStr(), rows: editor.get(), saveRecipe: $('recipe').checked };
    }

    function draw() {
      const rows = editor.get();
      if (!rows.length) {
        $('preview').innerHTML = '<div class="small muted">Add items to see the total.</div>';
        return;
      }
      const t = previewTotals(app, rows);
      $('preview').innerHTML = `
        <div class="row"><div class="grow"><div class="small muted">This meal</div>
          <div class="big num">${kcal(t.kcal)}</div>
          <div class="small muted num">${kj(t.kcal)} · ${macroLine(t)}</div></div>${sourceBadge(t.source)}</div>`;
    }
    draw();

    $('restart')?.addEventListener('click', () => { app.state.mealDraft = null; close(); setTimeout(() => openMealSheet(app, date), 320); });

    // Add a new item to the Fridge/Bar, then come back to this meal with it added.
    const addNew = (type) => {
      app.state.mealDraft = current();
      close();
      setTimeout(() => openItemForm(app, type, null, '', (saved) => {
        if (!saved || !app.state.mealDraft) return;
        const unit = saved.unit === 'serving' || N.isComposite(app.data, type, saved) ? 'serving' : saved.unit || 'g';
        app.state.mealDraft.rows.push({ itemType: type, itemId: saved.id, quantity: '', unit });
        openMealSheet(app);
      }), 320);
    };
    $('new-food').onclick = () => addNew('food');
    $('new-drink').onclick = () => addNew('drink');

    $('log').onclick = () => {
      const m = current();
      if (!m.rows.length) return alert('Add at least one item with an amount.');
      if (m.saveRecipe && !m.name) { alert('Give the meal a name to save it as a recipe.'); return $('name').focus(); }
      const t = previewTotals(app, m.rows);
      const label = describe(app, m.rows);
      const entry = {
        date: m.date, time: nowTime(), quantity: 1,
        kcal: round1(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat), source: t.source,
      };
      app.state.mealDraft = null;
      close();
      saveInBackground(app, async () => {
        if (m.saveRecipe) {
          const recipe = await app.store.saveWithIngredients('recipes', null, { name: m.name, servings: 1, notes: label }, 'recipe', m.rows);
          return app.store.add('logs', { ...entry, type: 'recipe', itemId: recipe.id, name: recipe.name, unit: 'serving' });
        }
        return app.store.add('logs', { ...entry, type: 'meal', itemId: '', name: `${m.name || 'Meal'}: ${label}`, unit: 'meal' });
      }, m.saveRecipe ? `Logged ${m.name} and saved it to Our Cookbook` : 'Meal logged');
    };
  });
}
