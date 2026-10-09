// Our Cookbook: recipes made from Fridge/Bar items.
import * as N from '../nutrition.js';
import { esc, fmt0, kcal, kj, macroLine, sourceBadge, openSheet, saveInBackground, icon } from '../ui.js';
import { ingredientEditor, previewTotals } from './ingredients.js';
import { openLogSheet } from './log.js';

export function render(el, app) {
  const recipes = [...app.data.recipes].sort((a, b) => a.name.localeCompare(b.name));

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">Family favourites</p><h1>Our Cookbook</h1></div>
      <button class="icon-btn" id="add" aria-label="Add recipe">${icon.plus}</button>
    </header>
    ${recipes.length ? `<div class="recipe-box">${recipes.map((r, i) => {
        const one = N.nutritionFor(app.data, 'recipe', r, 1, 'serving');
        const ings = N.ingredientsOf(app.data, 'recipe', r.id).map((g) => N.findItem(app.data, g.itemType, g.itemId)?.name).filter(Boolean);
        return `<button class="recipe-card" style="--tilt:${i % 2 ? 0.8 : -0.6}deg" data-id="${esc(r.id)}">
          <div class="rc-head"><span class="rc-title">${esc(r.name)}</span><span class="rc-kcal num">${fmt0(one.kcal)}<small>kcal</small></span></div>
          <div class="rc-body">
            <p>Serves ${fmt0(r.servings)} · ${ings.length} ingredient${ings.length === 1 ? '' : 's'} · ${one.source === 'label' ? 'label values' : 'estimated'}</p>
            <p>${esc(ings.join(', ') || 'No ingredients yet')}</p>
            <p class="num">Per serving: ${macroLine(one)}</p>
          </div>
        </button>`;
      }).join('')}</div>`
      : `<section class="card glass"><div class="empty"><p>No recipes yet. Recipes are built from items in Our Fridge and Our Bar.</p><button class="btn" id="add2">${icon.plus} Add a recipe</button></div></section>`}`;

  el.querySelectorAll('[data-id]').forEach((li) => (li.onclick = () => openRecipeForm(app, recipes.find((r) => r.id === li.dataset.id))));
  el.querySelector('#add').onclick = () => openRecipeForm(app);
  el.querySelector('#add2')?.addEventListener('click', () => openRecipeForm(app));
}

function openRecipeForm(app, recipe = null) {
  const isNew = !recipe;
  const v = recipe || { name: '', servings: 1, notes: '' };

  openSheet(isNew ? 'New recipe' : 'Edit recipe', (body, close) => {
    body.innerHTML = `
      <label class="field"><span>Name</span><input class="input" id="name" value="${esc(v.name)}" placeholder="e.g. Chicken wrap" autocomplete="off"></label>
      <label class="field"><span>Number of servings this makes</span><input class="input num" id="servings" inputmode="decimal" value="${esc(v.servings)}"></label>
      <div><div class="small muted" style="font-weight:600;margin:0 0 6px 4px">Ingredients (whole recipe)</div><div id="ings"></div></div>
      <div class="preview" id="preview"></div>
      <label class="field"><span>Notes / method</span><textarea class="input" id="notes" placeholder="Optional">${esc(v.notes)}</textarea></label>
      <div class="sheet-actions"><button class="btn" id="save">Save</button>
        ${isNew ? '' : '<button class="btn secondary" id="log">Log it</button>'}</div>
      ${isNew ? '' : `<button class="btn danger block small" id="delete">${icon.trash} Delete recipe</button>`}`;

    const $ = (id) => body.querySelector(`#${id}`);
    const editor = ingredientEditor($('ings'), app, recipe ? N.ingredientsOf(app.data, 'recipe', recipe.id) : [], { onChange: draw });

    function draw() {
      const t = previewTotals(app, editor.get());
      const servings = N.num($('servings').value) || 1;
      const one = N.scale(t, 1 / servings);
      $('preview').innerHTML = `
        <div class="row"><div class="grow"><div class="small muted">Per serving</div>
          <div class="big num">${kcal(one.kcal)}</div>
          <div class="small muted num">${kj(one.kcal)} · ${macroLine(one)}</div></div>${sourceBadge(t.source)}</div>
        <div class="small muted num" style="margin-top:8px">Whole recipe: ${kcal(t.kcal)} · ${kj(t.kcal)}</div>`;
    }
    $('servings').oninput = draw;
    draw();

    $('save').onclick = () => {
      const vals = { name: $('name').value.trim(), servings: N.num($('servings').value), notes: $('notes').value.trim() };
      if (!vals.name) return $('name').focus();
      if (vals.servings <= 0) return $('servings').focus();
      const ings = editor.get();
      if (!ings.length) return alert('Add at least one ingredient.');
      close();
      saveInBackground(app, () => app.store.saveWithIngredients('recipes', recipe?.id || null, vals, 'recipe', ings), `Saved ${vals.name}`);
    };

    $('log')?.addEventListener('click', () => { close(); setTimeout(() => openLogSheet(app, { type: 'recipe', item: recipe }), 320); });

    $('delete')?.addEventListener('click', () => {
      if (!confirm(`Delete ${recipe.name}? Your past log entries are kept.`)) return;
      close();
      saveInBackground(app, () => app.store.remove('recipes', recipe.id), `Deleted ${recipe.name}`);
    });
  });
}
