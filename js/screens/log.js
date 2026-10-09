// Bottom sheets for logging food/drinks/recipes and exercise.
import * as N from '../nutrition.js';
import { esc, fmt0, fmt1, kcal, kj, macroLine, sourceBadge, openSheet, saveInBackground, seg, segValue, wireSegs, icon, unitLabel, foodEmoji } from '../ui.js';

const TYPE_LABEL = { food: 'Fridge', drink: 'Bar', recipe: 'Cookbook' };
const round1 = (v) => Math.round(v * 10) / 10;
const nowTime = () => new Date().toTimeString().slice(0, 5);

function allItems(data) {
  const counts = new Map();
  for (const l of data.logs) counts.set(l.itemId, (counts.get(l.itemId) || 0) + 1);
  const list = [
    ...data.foods.map((item) => ({ type: 'food', item })),
    ...data.drinks.map((item) => ({ type: 'drink', item })),
    ...data.recipes.map((item) => ({ type: 'recipe', item })),
  ];
  // Most-used first, so "the usual" is at the top.
  return list.sort((a, b) => (counts.get(b.item.id) || 0) - (counts.get(a.item.id) || 0) || a.item.name.localeCompare(b.item.name));
}

/** Pick an item and log it. Optional `pre` = { type, item } skips the search step. */
export function openLogSheet(app, pre = null, date = N.dateStr()) {
  openSheet('Log food or drink', (body, close) => {
    if (pre) return showAmount(pre);

    const TABS = [['food', 'Food'], ['drink', 'Drinks'], ['recipe', 'Recipes']];
    const NOUN = { food: 'food', drink: 'drink', recipe: 'recipe' };
    let tab = app.state.logTab || 'food';

    body.innerHTML = `
      ${seg('cat', TABS, tab)}
      <label class="search">${icon.search}<input class="input" type="search" autocomplete="off" id="q"></label>
      <ul class="list" id="results"></ul>`;
    const q = body.querySelector('#q');
    const results = body.querySelector('#results');

    const draw = () => {
      const term = q.value.trim().toLowerCase();
      q.placeholder = `Search ${TABS.find((t) => t[0] === tab)[1].toLowerCase()}`;
      const matches = allItems(app.data).filter(({ item }) => item.name.toLowerCase().includes(term));
      const items = matches.filter((m) => m.type === tab);
      // Point to matches in the other categories when searching.
      const elsewhere = term ? TABS.filter(([t]) => t !== tab).map(([t, label]) => [t, label, matches.filter((m) => m.type === t).length]).filter((x) => x[2]) : [];
      const hint = elsewhere.length ? `<li class="empty" style="display:block"><p class="small">Also found in ${elsewhere.map(([t, label, n]) =>
        `<button type="button" class="btn ghost small" data-jump="${t}">${label} (${n})</button>`).join(' ')}</p></li>` : '';

      if (!items.length) {
        const add = tab === 'recipe'
          ? '<a class="btn secondary small" href="#cookbook" data-add="cookbook">Go to Our Cookbook</a>'
          : `<a class="btn secondary small" href="#${tab === 'food' ? 'fridge' : 'bar'}" data-add="${tab}">Add ${term ? `“${esc(q.value.trim())}”` : `a ${NOUN[tab]}`} to ${tab === 'food' ? 'Our Fridge' : 'Our Bar'}</a>`;
        results.innerHTML = `${hint}<li class="empty" style="display:block">
          <p>${term ? `No ${NOUN[tab]} called “${esc(q.value.trim())}”.` : `No ${NOUN[tab]}s saved yet.`}</p>${add}</li>`;
      } else {
        results.innerHTML = items.map(({ type, item }, i) => {
          const p = N.displayPortion(app.data, type, item);
          return `<li class="tap" data-i="${i}">
            <span class="item-emoji" aria-hidden="true">${type === 'recipe' ? '📖' : foodEmoji(item.name, type)}</span>
            <div class="grow"><div class="title">${esc(item.name)}</div>
              <div class="sub">per ${esc(p.label)}</div></div>
            <div class="value num">${fmt0(p.kcal)}<small>kcal</small></div></li>`;
        }).join('') + hint;
        results.querySelectorAll('li[data-i]').forEach((li) => (li.onclick = () => showAmount(items[li.dataset.i])));
      }
      // The Fridge/Bar screen opens its "add" form with this name filled in.
      results.querySelectorAll('[data-add]').forEach((a) => (a.onclick = () => {
        if (a.dataset.add !== 'cookbook') app.state.addName = q.value.trim() || ' ';
        close();
        if (location.hash === a.getAttribute('href')) app.render();
      }));
      results.querySelectorAll('[data-jump]').forEach((b) => (b.onclick = () => select(b.dataset.jump)));
    };

    const select = (t) => {
      tab = app.state.logTab = t;
      body.querySelectorAll('[data-seg="cat"] button').forEach((b) => b.classList.toggle('active', b.dataset.value === t));
      draw();
    };
    wireSegs(body, (_, t) => select(t));
    q.oninput = draw;
    draw();

    function showAmount(sel) {
      showAmountForm(app, body, close, sel, date);
    }
  });
}

function showAmountForm(app, body, close, { type, item }, date) {
  const units = N.unitsFor(app.data, type, item);
  const defUnit = units.includes('serving') ? 'serving' : units[0];
  const defQty = defUnit === 'serving' ? 1 : 100;
  const unitName = (u) => (u === 'serving'
    ? (N.isComposite(app.data, type, item) || item.unit === 'serving' ? 'serving' : `serving (${fmt0(item.servingSize)} ${item.unit})`)
    : u);

  body.innerHTML = `
    <div><div class="title" style="font-size:20px;font-weight:700">${esc(item.name)}</div>
      <div class="small muted">${TYPE_LABEL[type]}</div></div>
    <div class="grid-2">
      <label class="field"><span>Amount</span><input class="input num" id="qty" inputmode="decimal" value="${defQty}"></label>
      <label class="field"><span>Date</span><input class="input" id="date" type="date" value="${date}"></label>
    </div>
    ${units.length > 1 ? seg('unit', units.map((u) => [u, unitName(u)]), defUnit) : `<div class="small muted">Unit: ${esc(unitName(units[0]))}</div>`}
    <div class="preview" id="preview"></div>
    <div class="sheet-actions"><button class="btn block" id="log">Log it</button></div>`;

  const qty = body.querySelector('#qty');
  const preview = body.querySelector('#preview');
  const unit = () => (units.length > 1 ? segValue(body, 'unit') : units[0]);

  const calc = () => N.nutritionFor(app.data, type, item, qty.value, unit());
  const draw = () => {
    const n = calc();
    preview.innerHTML = `
      <div class="row"><div class="grow"><div class="big num">${kcal(n.kcal)}</div><div class="small muted num">${kj(n.kcal)}</div></div>${sourceBadge(n.source)}</div>
      <div class="small num" style="margin-top:6px">${macroLine(n)}</div>
      ${n.missing.length ? '<div class="notice" style="margin-top:10px">Some ingredients no longer exist, so this total may be too low.</div>' : ''}`;
  };
  wireSegs(body, (_, u) => { qty.value = u === 'serving' ? 1 : 100; draw(); });
  qty.oninput = draw;
  draw();

  body.querySelector('#log').onclick = () => {
    const q = N.num(qty.value);
    if (q <= 0) return qty.focus();
    const n = calc();
    close();
    saveInBackground(app, () => app.store.add('logs', {
      date: body.querySelector('#date').value || N.dateStr(),
      time: nowTime(),
      type,
      itemId: item.id,
      name: item.name,
      quantity: q,
      unit: unit(),
      kcal: round1(n.kcal),
      protein: round1(n.protein),
      carbs: round1(n.carbs),
      fat: round1(n.fat),
      source: n.source,
    }), `Logged ${item.name}`);
  };
}

/** Log exercise using MET values. */
export function openExerciseSheet(app, date = N.dateStr()) {
  const settings = app.data.settings;
  const weight = N.num(settings.weightKg);
  openSheet('Log exercise', (body, close) => {
    if (!weight) {
      body.innerHTML = `<div class="empty"><p>Add your weight in your profile first. It’s needed to work out calories burned.</p>
        <a class="btn" href="#profile">Open profile</a></div>`;
      body.querySelector('a').onclick = close;
      return;
    }
    body.innerHTML = `
      <label class="field"><span>Activity</span>
        <select class="input" id="ex">${N.EXERCISES.map((x) => `<option value="${x.id}">${esc(x.label)} — MET ${x.met}</option>`).join('')}</select></label>
      <div class="grid-2">
        <label class="field"><span>Minutes</span><input class="input num" id="min" inputmode="decimal" value="30"></label>
        <label class="field"><span>Date</span><input class="input" id="date" type="date" value="${date}"></label>
      </div>
      <div class="preview" id="preview"></div>
      <p class="tiny">Net calories = (MET − 1) × ${fmt1(weight)} kg × hours. These are estimates.
        ${settings.addExercise === 'yes' ? 'They are added to today’s allowance.' : 'They’re shown on Home but not added to your allowance (you can change this in your profile).'}</p>
      <div class="sheet-actions"><button class="btn block" id="log">Log exercise</button></div>`;

    const ex = body.querySelector('#ex');
    const min = body.querySelector('#min');
    const preview = body.querySelector('#preview');
    const current = () => N.EXERCISES.find((x) => x.id === ex.value);
    const burned = () => N.exerciseKcal(current().met, weight, min.value);
    const draw = () => (preview.innerHTML = `<div class="big num">${kcal(burned())}</div><div class="small muted num">${kj(burned())} burned</div>`);
    ex.onchange = min.oninput = draw;
    draw();

    body.querySelector('#log').onclick = () => {
      const minutes = N.num(min.value);
      if (minutes <= 0) return min.focus();
      close();
    saveInBackground(app, () => app.store.add('logs', {
        date: body.querySelector('#date').value || N.dateStr(),
        time: nowTime(),
        type: 'exercise',
        itemId: current().id,
        name: current().label,
        quantity: minutes,
        unit: 'min',
        kcal: round1(burned()),
        protein: '', carbs: '', fat: '',
        source: 'estimated',
      }), 'Exercise logged');
    };
  });
}

/** One log entry as a list row (used on Home and in Reports). */
export function logRow(l) {
  const ex = l.type === 'exercise';
  const meal = l.type === 'meal';
  // Meals are stored as "Name: item, item, …" — show the name as the title and the items underneath.
  const split = meal ? String(l.name).indexOf(': ') : -1;
  const title = split > 0 ? l.name.slice(0, split) : l.name;
  const contents = split > 0 ? l.name.slice(split + 2) : '';
  const amount = ex ? `${fmt0(l.quantity)} min` : meal ? 'Meal' : `${fmt1(l.quantity)} ${unitLabel(l.unit)}${l.unit === 'serving' && N.num(l.quantity) !== 1 ? 's' : ''}`;
  return `<li class="tap" data-entry="${esc(l.id)}">
    <div class="grow"><div class="title">${ex ? icon.flame.replace('width="24" height="24"', 'width="15" height="15"') + ' ' : ''}${esc(title)}</div>
      ${contents ? `<div class="sub">${esc(contents)}</div>` : ''}
      <div class="sub">${esc(amount)} · ${esc(l.time || '')} ${ex ? '' : sourceBadge(l.source)}</div></div>
    <div class="value num">${ex ? '−' : ''}${fmt0(l.kcal)} kcal<small>${kj(l.kcal)}</small></div>
    <span class="icon-btn plain" aria-hidden="true">${icon.pencil}</span>
  </li>`;
}

/** Tapping an entry opens its edit sheet. */
export function wireEntries(container, app) {
  container.querySelectorAll('[data-entry]').forEach((li) => {
    li.onclick = () => {
      const entry = app.data.logs.find((l) => l.id === li.dataset.entry);
      if (entry) openEditEntry(app, entry);
    };
  });
}

/**
 * Edit a logged entry: date and time always; amount (food/drink/recipe), minutes (exercise)
 * or name (meal). Calories are recalculated only when the amount changes; otherwise the
 * values it was logged with are kept.
 */
export function openEditEntry(app, entry) {
  const ex = entry.type === 'exercise';
  const meal = entry.type === 'meal';
  const item = !ex && !meal ? N.findItem(app.data, entry.type, entry.itemId) : null;
  const exercise = ex ? N.EXERCISES.find((x) => x.id === entry.itemId) : null;
  const weight = N.num(app.data.settings.weightKg);
  const units = item ? N.unitsFor(app.data, entry.type, item) : [];
  const canRecalc = Boolean(item) || Boolean(exercise && weight);
  const startQty = N.num(entry.quantity);
  const startUnit = entry.unit;

  openSheet('Edit entry', (body, close) => {
    body.innerHTML = `
      ${meal ? `<label class="field"><span>Name</span><input class="input" id="name" value="${esc(entry.name)}"></label>`
        : `<div><div class="title" style="font-size:20px;font-weight:700">${esc(entry.name)}</div>
            <div class="small muted">${ex ? 'Exercise' : TYPE_LABEL[entry.type] || ''}</div></div>`}
      <div class="grid-2">
        <label class="field"><span>Date</span><input class="input" id="date" type="date" value="${esc(entry.date)}"></label>
        <label class="field"><span>Time</span><input class="input" id="time" type="time" value="${esc(entry.time || '12:00')}"></label>
      </div>
      ${canRecalc ? `<label class="field"><span>${ex ? 'Minutes' : 'Amount'}</span><input class="input num" id="qty" inputmode="decimal" value="${fmt1(startQty)}"></label>
        ${units.length > 1 ? seg('unit', units.map((u) => [u, u === 'serving' && N.num(item.servingSize) && item.unit !== 'serving' && !N.isComposite(app.data, entry.type, item) ? `serving (${fmt0(item.servingSize)} ${item.unit})` : u]), units.includes(startUnit) ? startUnit : units[0]) : ''}`
        : !meal ? '<p class="small muted" style="margin:0">The saved item no longer exists, so only the date and time can be changed.</p>' : ''}
      <div class="preview" id="preview"></div>
      <div class="sheet-actions"><button class="btn" id="save">Save changes</button></div>
      <button class="btn danger block small" id="delete">${icon.trash} Delete entry</button>`;

    const $ = (id) => body.querySelector(`#${id}`);
    const unit = () => (units.length > 1 ? segValue(body, 'unit') : units[0] || startUnit);
    const changedAmount = () => canRecalc && (N.num($('qty').value) !== startQty || unit() !== startUnit);

    const calc = () => {
      if (!changedAmount()) return null;
      const q = N.num($('qty').value);
      if (ex) return { kcal: N.exerciseKcal(exercise.met, weight, q), protein: '', carbs: '', fat: '', source: 'estimated' };
      return N.nutritionFor(app.data, entry.type, item, q, unit());
    };

    const draw = () => {
      const n = calc() || { kcal: N.num(entry.kcal), protein: N.num(entry.protein), carbs: N.num(entry.carbs), fat: N.num(entry.fat), source: entry.source };
      $('preview').innerHTML = `
        <div class="row"><div class="grow"><div class="big num">${ex ? '−' : ''}${kcal(n.kcal)}</div><div class="small muted num">${kj(n.kcal)}</div></div>${ex ? '' : sourceBadge(n.source)}</div>
        ${ex ? '' : `<div class="small num" style="margin-top:6px">${macroLine(n)}</div>`}
        ${changedAmount() ? '<div class="tiny" style="margin-top:6px">Recalculated from the saved values</div>' : ''}`;
    };
    wireSegs(body, (_, u) => { $('qty').value = u === 'serving' ? 1 : 100; draw(); });
    $('qty')?.addEventListener('input', draw);
    draw();

    $('save').onclick = () => {
      const changes = { date: $('date').value || entry.date, time: $('time').value || entry.time };
      if (meal) {
        const name = $('name').value.trim();
        if (!name) return $('name').focus();
        changes.name = name;
      }
      if (canRecalc) {
        const q = N.num($('qty').value);
        if (q <= 0) return $('qty').focus();
        const n = calc();
        if (n) {
          Object.assign(changes, { quantity: q, unit: unit(), kcal: round1(n.kcal), source: n.source });
          if (!ex) Object.assign(changes, { protein: round1(n.protein), carbs: round1(n.carbs), fat: round1(n.fat) });
        }
      }
      close();
      saveInBackground(app, () => app.store.update('logs', entry.id, changes), 'Entry updated');
    };

    $('delete').onclick = () => {
      if (!confirm(`Delete this entry?`)) return;
      close();
      saveInBackground(app, () => app.store.remove('logs', entry.id), 'Entry deleted');
    };
  });
}

/** Entries grouped under meal-time headings (Breakfast, Lunch, …), each with its calorie subtotal. */
export function groupedLogRows(entries) {
  const sorted = [...entries].sort((a, b) => (String(a.time) < String(b.time) ? -1 : 1));
  const groups = [];
  for (const m of [...N.MEAL_TIMES, { id: 'exercise', label: 'Exercise', emoji: '🔥' }]) {
    const rows = sorted.filter((l) => (m.id === 'exercise' ? l.type === 'exercise' : l.type !== 'exercise' && N.mealTime(l.time).id === m.id));
    if (!rows.length) continue;
    const total = rows.reduce((s, l) => s + N.num(l.kcal), 0);
    groups.push(`<li class="group-head"><span>${m.emoji} ${esc(m.label)}</span><span class="num">${m.id === 'exercise' ? '−' : ''}${fmt0(total)} kcal</span></li>${rows.map(logRow).join('')}`);
  }
  return `<ul class="list grouped">${groups.join('')}</ul>`;
}
