// Small shared UI helpers: escaping, number formatting, icons, bottom sheet, toast.
import { kcalToKj } from './nutrition.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

export const fmt0 = (n) => nf0.format(Math.round(Number(n) || 0));
export const fmt1 = (n) => nf1.format(Number(n) || 0);
export const kcal = (n) => `${fmt0(n)} kcal`;
export const kj = (n) => `${fmt0(kcalToKj(n))} kJ`;

export function sourceBadge(source) {
  return source === 'label'
    ? '<span class="badge badge-label" title="Values from the product label">Label</span>'
    : '<span class="badge badge-est" title="Estimated values">Estimated</span>';
}

export function macroLine(n) {
  return `P ${fmt1(n.protein)} g · C ${fmt1(n.carbs)} g · F ${fmt1(n.fat)} g`;
}

export function prettyDate(str, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
}

export const unitLabel = (u) => (u === 'serving' ? 'serving' : u);

// ---------- Icons (inline SVG, stroke = currentColor) ----------

const svg = (path) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const icon = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>'),
  fridge: svg('<rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M5 10h14"/><path d="M9 6v1.5M9 13v3"/>'),
  bar: svg('<path d="M5 3h14l-6 8v7"/><path d="M8.5 21h7"/><path d="M13 18v3"/><path d="M7 6h10"/>'),
  book: svg('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20v-3"/><path d="M9 8h7M9 11.5h5"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  left: svg('<path d="m15 18-6-6 6-6"/>'),
  right: svg('<path d="m9 18 6-6-6-6"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  flame: svg('<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2 1.5-3 3.5-3 6-1-1-2-2-2-4-2.5 2-5 5-5 8 0 4.3 3 7 7 7z"/>'),
  scale: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9a5 5 0 0 1 8 0l-2.5 2.5"/>'),
};

// ---------- Toast ----------

let toastTimer;
export function toast(message, kind = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast glass show ${kind}`;
  clearTimeout(toastTimer);
  // A "pending" toast stays until the next message replaces it.
  if (kind !== 'pending') toastTimer = setTimeout(() => (el.className = `toast glass ${kind}`), kind === 'error' ? 6000 : 2400);
}

// ---------- Background saving ----------

let pendingSaves = 0;
window.addEventListener('beforeunload', (e) => {
  if (pendingSaves) { e.preventDefault(); e.returnValue = ''; }
});

/**
 * Save without making the user wait: shows "Saving…" until Google Sheets confirms,
 * then a success message and fresh data, or an error saying it was not saved.
 */
export function saveInBackground(app, action, successMessage, onSaved = null) {
  pendingSaves++;
  toast('Saving…', 'pending');
  action()
    .then(async (result) => {
      pendingSaves--;
      toast(pendingSaves ? 'Saving…' : successMessage, pendingSaves ? 'pending' : 'ok');
      await app.refresh();
      // Runs after the fresh data has loaded, e.g. to continue with the saved item.
      onSaved?.(result);
    })
    .catch((err) => {
      pendingSaves--;
      toast(err.message || 'Save failed. Nothing was saved.', 'error');
    });
}

// ---------- Bottom sheet ----------

/** Open a bottom sheet. `build(body, close)` fills it. */
export function openSheet(title, build) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = `
    <div class="sheet-backdrop"></div>
    <section class="sheet glass" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <header class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Close">${icon.close}</button>
      </header>
      <div class="sheet-body"></div>
    </section>`;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => root.classList.add('open'));

  const close = () => {
    root.classList.remove('open');
    document.body.classList.remove('sheet-open');
    setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 300);
  };
  root.querySelector('.sheet-backdrop').onclick = close;
  root.querySelector('[data-close]').onclick = close;
  build(root.querySelector('.sheet-body'), close);
  return close;
}

/** Run a save action; show success only if it really succeeded. */
export async function saving(button, action, successMessage) {
  const label = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  try {
    const result = await action();
    if (successMessage) toast(successMessage);
    return { ok: true, result };
  } catch (err) {
    toast(err.message || 'Save failed. Nothing was saved.', 'error');
    return { ok: false };
  } finally {
    if (button) { button.disabled = false; button.textContent = label; }
  }
}

/** Wire a segmented control: `<div class="seg" data-seg="name">` with buttons having data-value. */
export function segValue(container, name) {
  return container.querySelector(`[data-seg="${name}"] .active`)?.dataset.value ?? '';
}

export function wireSegs(container, onChange) {
  container.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      onChange?.(seg.dataset.seg, btn.dataset.value);
    });
  });
}

export function seg(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options
    .map(([v, label]) => `<button type="button" data-value="${esc(v)}" class="${v === value ? 'active' : ''}">${esc(label)}</button>`)
    .join('')}</div>`;
}

// ---------- Food emoji (for fridge magnets) ----------

const EMOJI = [
  [/yog/i, '🥣'], [/chicken|hoender/i, '🍗'], [/beef|steak|mince|burger|biltong|boerewors|droëwors/i, '🥩'],
  [/\bham\b|bacon|pork|salami/i, '🥓'], [/\begg/i, '🥚'], [/milk/i, '🥛'], [/cheese|cottage|feta|mozzarella/i, '🧀'],
  [/avo/i, '🥑'], [/lettuce|salad|spinach|\bgem\b|cabbage/i, '🥬'], [/tomato/i, '🍅'], [/cucumber/i, '🥒'],
  [/tortilla|wrap|bread|toast|\broll|pita/i, '🫓'], [/mayo|sauce|mustard|ketchup|dressing|pesto/i, '🫙'],
  [/syrup|honey/i, '🍯'], [/rice/i, '🍚'], [/pasta|noodle|spaghetti/i, '🍝'], [/potato|chips|fries/i, '🥔'],
  [/apple/i, '🍎'], [/banana/i, '🍌'], [/berry|strawberr/i, '🍓'], [/orange|naartjie/i, '🍊'], [/grape/i, '🍇'],
  [/fish|tuna|salmon|hake|snoek/i, '🐟'], [/oat|cereal|muesli|granola|pronutro/i, '🥣'], [/nut|peanut|almond/i, '🥜'],
  [/choc/i, '🍫'], [/butter|margarine/i, '🧈'], [/onion/i, '🧅'], [/carrot/i, '🥕'], [/corn|mielie/i, '🌽'],
  [/coffee|espresso|latte|cappuccino|americano/i, '☕'], [/tea|rooibos/i, '🫖'], [/sparkling|water|soda/i, '🫧'],
  [/beer|lager|ale\b|cider/i, '🍺'], [/wine/i, '🍷'], [/juice/i, '🧃'], [/gin|vodka|whisk|rum|brandy|tequila/i, '🥃'],
  [/cola|coke|fizzy/i, '🥤'], [/smoothie|shake/i, '🥤'],
];

export function foodEmoji(name, type = 'food') {
  const hit = EMOJI.find(([re]) => re.test(name));
  return hit ? hit[1] : type === 'drink' ? '🥤' : '🍽️';
}

/** Stable small number from a string (used to vary magnet colours and tilt). */
export function hashOf(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}
