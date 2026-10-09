// Small animated SVG charts: rings, donut, bars (single or stacked) and lines.
// Every chart animates in when `animate(container)` is called after it is in the page.
// Tap/hover shows exact values via a tooltip.
import { esc, fmt1 } from './ui.js';

const W = 340; // viewBox width; charts scale to the card width

/** Start the entrance animations of all charts inside `root`. */
export function animate(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll('.anim').forEach((el) => el.classList.add('in'))));
}

function niceStep(max, ticks = 4) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
}

const short = (v) => (v >= 1000 ? `${fmt1(v / 1000)}k` : `${Math.round(v * 10) / 10}`);

// ---------- Ring ----------

/** A progress ring (value / max). `cls` picks the colour (kcal, protein, carbs, fat). */
export function ring({ value, max, cls = 'kcal', size = 120, stroke = 12, over = false, center = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return `<div class="ring-chart anim" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring-v ${cls} ${over ? 'over' : ''}" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke-dasharray="${c}" stroke-dashoffset="${c}" style="--to:${c * (1 - pct)}"/>
    </svg>
    <div class="ring-center">${center}</div>
  </div>`;
}

// ---------- Donut ----------

/** Donut of parts: [{ value, cls }]. Each segment grows from its start point. */
export function donut({ parts, size = 132, stroke = 20, center = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0);
  const gap = parts.filter((p) => p.value > 0).length > 1 ? 2 : 0;
  let start = 0;
  const segs = parts.map((p) => {
    const len = total ? (p.value / total) * c : 0;
    const angle = (start / c) * 360; // the whole SVG is already turned so 0° is at the top
    start += len;
    const draw = Math.max(0, len - gap);
    if (!draw) return '';
    return `<circle class="donut-seg ${p.cls}" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
      stroke-dasharray="${draw} ${c}" stroke-dashoffset="${draw}" style="--to:0"
      transform="rotate(${angle} ${size / 2} ${size / 2})"/>`;
  }).join('');
  return `<div class="ring-chart anim" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>${segs}
    </svg>
    <div class="ring-center">${center}</div>
  </div>`;
}

// ---------- Tooltip ----------

function tooltip(el, svg, H) {
  const tip = document.createElement('div');
  tip.className = 'tip hidden';
  el.append(tip);
  return {
    show(html, vx, vy) {
      const rect = svg.getBoundingClientRect();
      tip.innerHTML = html;
      tip.classList.remove('hidden');
      const half = tip.offsetWidth / 2 + 4;
      tip.style.left = `${Math.min(Math.max((vx / W) * rect.width, half), rect.width - half)}px`;
      tip.style.top = `${Math.max(0, (vy / H) * rect.height - tip.offsetHeight - 8)}px`;
    },
    hide() { tip.classList.add('hidden'); },
  };
}

// ---------- Bars ----------

/**
 * Bar chart into `el`.
 * series: [{ cls, values: [] }] — more than one series is stacked (bottom first).
 * labels: x labels (an empty string hides one). target: optional horizontal line.
 * tip(i): tooltip HTML for column i.
 */
export function bars(el, { series, labels, target = 0, targetLabel = '', tip, height = 190, unit = '' }) {
  const H = height, padL = 34, padR = 8, padT = 16, padB = 22;
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((s, sr) => s + (sr.values[i] || 0), 0));
  const max = Math.max(target, ...totals, 1) * 1.12;
  const step = niceStep(max);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const slot = (W - padL - padR) / n;
  const bw = Math.max(3, Math.min(26, slot * 0.62));
  const base = y(0);

  let grid = '';
  for (let v = 0; v <= max; v += step) {
    grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis-label" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`;
  }

  const cols = labels.map((label, i) => {
    const cx = padL + slot * i + slot / 2;
    const x0 = cx - bw / 2;
    let acc = 0;
    const visible = series.map((sr) => sr.values[i] || 0).map((v, k) => [v, k]).filter(([v]) => v > 0);
    const segs = visible.map(([v, k], j) => {
      const top = y(acc + v);
      const bottom = y(acc) - (j > 0 ? 2 : 0); // 2px gap between stacked segments
      acc += v;
      const h = Math.max(0, bottom - top);
      if (!h) return '';
      const isTop = j === visible.length - 1;
      const r = isTop ? Math.min(4, h / 2, bw / 2) : 0;
      const d = `M${x0},${bottom} V${top + r} q0,-${r} ${r},-${r} H${x0 + bw - r} q${r},0 ${r},${r} V${bottom} Z`;
      return `<path class="bar-seg ${series[k].cls}" d="${d}"/>`;
    }).join('');
    return `<g class="col" data-i="${i}" style="transition-delay:${Math.min(i * 35, 600)}ms">${segs}</g>
      ${label ? `<text class="axis-label" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(label)}</text>` : ''}
      <rect class="hit" data-i="${i}" x="${cx - slot / 2}" y="${padT}" width="${slot}" height="${base - padT}"/>`;
  }).join('');

  const tline = target ? `<line class="target" x1="${padL}" x2="${W - padR}" y1="${y(target)}" y2="${y(target)}"/>
    <text class="target-label" x="${W - padR}" y="${y(target) - 5}" text-anchor="end">${esc(targetLabel)} ${short(target)}${unit}</text>` : '';

  el.innerHTML = `<svg class="anim" viewBox="0 0 ${W} ${H}" role="img">${grid}${cols}${tline}</svg>`;
  const svg = el.querySelector('svg');
  const t = tooltip(el, svg, H);
  const show = (i) => {
    svg.querySelectorAll('.col').forEach((c) => c.classList.toggle('dim', c.dataset.i !== String(i)));
    const cx = padL + slot * i + slot / 2;
    t.show(tip(i), cx, Math.min(y(totals[i]), y(target || 0)));
  };
  svg.querySelectorAll('.hit').forEach((h) => {
    h.addEventListener('pointerenter', () => show(Number(h.dataset.i)));
    h.addEventListener('click', () => show(Number(h.dataset.i)));
  });
  svg.addEventListener('pointerleave', () => { t.hide(); svg.querySelectorAll('.col').forEach((c) => c.classList.remove('dim')); });
}

// ---------- Line ----------

/**
 * Line chart into `el`.
 * points: [{ x, y }] in data units. xDomain: [min, max]. xTicks: [{ x, label }].
 * step: draw as steps (running totals). target: optional horizontal line. tip(i): tooltip HTML.
 */
export function line(el, { points, xDomain, xTicks = [], yPad = 0, yMin = null, target = 0, targetLabel = '', step = false, tip, height = 180, area = false }) {
  const H = height, padL = 36, padR = 12, padT = 14, padB = 22;
  const ys = points.map((p) => p.y).concat(target ? [target] : []);
  let lo = yMin ?? Math.min(...ys) - yPad;
  let hi = Math.max(...ys) + yPad;
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  if (yPad === 0) hi *= 1.08; // headroom above the highest point
  const stepV = niceStep(hi - lo);
  lo = Math.floor(lo / stepV) * stepV;
  const [x0, x1] = xDomain;
  const x = (v) => padL + ((v - x0) / (x1 - x0 || 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);

  let grid = '';
  for (let v = lo; v <= hi + 1e-9; v += stepV) {
    grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis-label" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`;
  }
  const ticks = xTicks.map((tk) => `<text class="axis-label" x="${x(tk.x)}" y="${H - 6}" text-anchor="middle">${esc(tk.label)}</text>`).join('');

  const pts = points.map((p) => [x(p.x), y(p.y)]);
  // Steps start from zero at the left edge (a running total); plain lines join the points.
  let d = step ? `M${x(x0)},${y(lo)}` : '';
  pts.forEach(([px, py], i) => {
    d += step ? ` H${px} V${py}` : `${i ? ' L' : 'M'}${px},${py}`;
  });
  if (step && pts.length) d += ` H${x(x1)}`;
  const fill = area && pts.length ? `<path class="line-area" d="${d} V${y(lo)} H${step ? x(x0) : pts[0][0]} Z"/>` : '';
  const dots = pts.length <= 40 ? pts.map(([px, py], i) => `<circle class="dot" cx="${px}" cy="${py}" r="4" style="transition-delay:${600 + i * 20}ms"/>`).join('') : '';
  const tline = target ? `<line class="target" x1="${padL}" x2="${W - padR}" y1="${y(target)}" y2="${y(target)}"/>
    <text class="target-label" x="${W - padR}" y="${y(target) - 5}" text-anchor="end">${esc(targetLabel)} ${short(target)}</text>` : '';

  el.innerHTML = `<svg class="anim" viewBox="0 0 ${W} ${H}" role="img">${grid}${ticks}${tline}${fill}
    <path class="line" d="${d}" pathLength="1"/>${dots}
    <line class="cross hidden" y1="${padT}" y2="${H - padB}"/>
    <rect class="hit" x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}"/></svg>`;

  const svg = el.querySelector('svg');
  const t = tooltip(el, svg, H);
  const cross = svg.querySelector('.cross');
  const move = (e) => {
    if (!pts.length) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p[0] - vx) < Math.abs(pts[best][0] - vx)) best = i; });
    cross.setAttribute('x1', pts[best][0]); cross.setAttribute('x2', pts[best][0]);
    cross.classList.remove('hidden');
    t.show(tip(best), pts[best][0], pts[best][1]);
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => { t.hide(); cross.classList.add('hidden'); });
}

/** Legend row: [{ cls, label }] */
export function legend(items) {
  return `<div class="legend">${items.map((i) => `<span><i class="swatch ${i.cls}"></i>${esc(i.label)}</span>`).join('')}</div>`;
}
