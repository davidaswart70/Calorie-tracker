// Streak strip (Home), Awards tab (Reports) and the "award unlocked" celebration.
import * as N from '../nutrition.js';
import { evaluateAwards } from '../awards.js';
import { esc } from '../ui.js';

const SEEN_KEY = 'calorie-tracker-awards-seen';

/** Small row of current streaks for Home. Tapping it opens the Awards tab. */
export function streakStrip(app) {
  const s = N.streaks(app.data.logs, app.data.settings);
  const chip = (emoji, n, label) => `<span class="streak-chip ${n ? 'on' : ''}"><b>${emoji} ${n}</b><small>${label}</small></span>`;
  return `<a class="streaks glass" href="#reports" id="streaks">
    ${chip('🔥', s.logging.current, 'day streak')}
    ${chip('🎯', s.onTarget.current, 'on target')}
    ${chip('💪', s.protein.current, 'protein')}
    <span class="streak-more">Awards ›</span>
  </a>`;
}

export function wireStreakStrip(el, app) {
  el.querySelector('#streaks')?.addEventListener('click', () => {
    app.state.reports = { ...(app.state.reports || {}), tab: 'awards' };
  });
}

function badge(b) {
  return `<div class="badge-card ${b.earned ? 'earned' : 'locked'}">
    <div class="badge-emoji">${b.emoji}</div>
    <b>${esc(b.title)}</b>
    <small>${esc(b.desc)}</small>
    ${b.earned ? '<span class="badge-done">Unlocked</span>' : `<div class="share-bar anim"><i style="--w:${(b.progress * 100).toFixed(1)}%"></i></div><small class="num">${esc(b.progressText)}</small>`}
  </div>`;
}

/** Reports → Awards tab. */
export function awardsTab(el, app) {
  const s = N.streaks(app.data.logs, app.data.settings);
  const all = evaluateAwards(app.data);
  const earned = all.filter((b) => b.earned);
  const next = all.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress);
  const groups = [...new Set(all.map((b) => b.group))];
  const tile = (emoji, label, st) => `<div class="tile streak-tile"><span>${emoji} ${label}</span><b class="num">${st.current}</b><small class="num">days now · best ${st.best}</small></div>`;

  el.innerHTML = `
    <section class="card glass">
      <h2>Streaks</h2>
      <div class="tiles">
        ${tile('🔥', 'Logging', s.logging)}
        ${tile('🎯', 'On target', s.onTarget)}
        ${tile('💪', 'Protein goal', s.protein)}
        <div class="tile"><span>🏆 Awards</span><b class="num">${earned.length}/${all.length}</b><small>unlocked</small></div>
      </div>
    </section>
    ${next.length ? `<section class="card glass">
      <h2>Almost there</h2>
      <div class="badge-grid">${next.slice(0, 4).map(badge).join('')}</div>
    </section>` : ''}
    ${groups.map((g) => `<section class="card glass">
      <h2>${esc(g)}</h2>
      <div class="badge-grid">${all.filter((b) => b.group === g).sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress).map(badge).join('')}</div>
    </section>`).join('')}`;

  markSeen(earned.map((b) => b.id));
}

// ---------- Celebration ----------

function readSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); } catch { return null; }
}
function markSeen(ids) {
  try {
    const seen = new Set(readSeen() || []);
    ids.forEach((id) => seen.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch { /* storage unavailable: just celebrate again next time */ }
}

/** After data loads: celebrate awards unlocked since last time. The first run only records them. */
export function checkNewAwards(app) {
  const earned = evaluateAwards(app.data).filter((b) => b.earned);
  const seen = readSeen();
  if (!seen) return markSeen(earned.map((b) => b.id));
  const fresh = earned.filter((b) => !seen.includes(b.id));
  if (!fresh.length) return;
  markSeen(fresh.map((b) => b.id));
  // Lead with the fun ones; within a kind of badge, the biggest tier first (a quarter of a cow beats 1 kg of beef).
  const ids = evaluateAwards(app.data).map((b) => b.id);
  const kind = (b) => ids.findIndex((id) => id.replace(/-[^-]+$/, '') === b.id.replace(/-[^-]+$/, ''));
  const fun = (b) => (b.group === 'Just for fun' ? 0 : 1);
  celebrate([...fresh].sort((a, b) => fun(a) - fun(b) || kind(a) - kind(b) || b.goal - a.goal), app);
}

function celebrate(list, app) {
  const root = document.createElement('div');
  root.className = 'celebrate';
  root.innerHTML = `
    <canvas></canvas>
    <div class="celebrate-card glass" role="dialog" aria-label="Award unlocked">
      <div class="badge-emoji big">${list[0].emoji}</div>
      <p class="eyebrow">${list.length > 1 ? `${list.length} awards unlocked!` : 'Award unlocked!'}</p>
      <h2>${esc(list[0].title)}</h2>
      <p class="small muted">${esc(list[0].desc)}</p>
      ${list.length > 1 ? `<p class="small">${list.slice(1).map((b) => `${b.emoji} ${esc(b.title)}`).join(' · ')}</p>` : ''}
      <div class="sheet-actions"><button class="btn ghost" data-close>Nice</button><a class="btn" href="#reports" data-awards>See awards</a></div>
    </div>`;
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('open'));
  const stop = confetti(root.querySelector('canvas'));
  const close = () => { stop(); root.classList.remove('open'); setTimeout(() => root.remove(), 300); };
  root.querySelector('[data-close]').onclick = close;
  root.querySelector('[data-awards]').onclick = () => {
    app.state.reports = { ...(app.state.reports || {}), tab: 'awards' };
    close();
    if (location.hash === '#reports') app.render();
  };
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
}

/** Simple falling confetti on a canvas. Returns a stop function. */
function confetti(canvas) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
  resize();
  const colors = ['#1f9d55', '#3b7fd4', '#b87a12', '#e85d75', '#8b5cf6', '#f2c94c'];
  const bits = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width, y: -Math.random() * canvas.height * 0.6,
    w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
    vy: (2 + Math.random() * 3) * dpr, vx: (Math.random() - 0.5) * 2 * dpr,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  let raf, frames = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    }
    if (++frames < 360) raf = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(raf);
}
