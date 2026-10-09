// Weekly Wrapped: Home banner and the full-screen story player.
import { weekWrapped, lastWeekStart } from '../wrapped.js';
import { esc, icon } from '../ui.js';

const SEEN_KEY = 'calorie-tracker-wrapped-seen';
const SLIDE_MS = 5000;

const seenWeek = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const markSeen = (start) => { try { localStorage.setItem(SEEN_KEY, start); } catch { /* ignore */ } };

/** Banner on Home for last week's Wrapped, until it has been watched. */
export function wrappedBanner(app) {
  const start = lastWeekStart();
  if (seenWeek() === start || !weekWrapped(app.data, start)) return '';
  return `<button class="wrapped-banner" id="wrapped-banner">
    <span class="wrapped-gift">🎁</span>
    <span class="grow"><b>Your week is wrapped</b><small>Tap to see last week’s highlights</small></span>
    <span class="wrapped-play">▶</span>
  </button>`;
}

export function wireWrappedBanner(el, app) {
  el.querySelector('#wrapped-banner')?.addEventListener('click', () => {
    const start = lastWeekStart();
    markSeen(start);
    playWrapped(app, start);
  });
}

/** Full-screen story for the 7 days starting `start`. Tap right/left to skip, × to close. */
export function playWrapped(app, start) {
  const slides = weekWrapped(app.data, start);
  if (!slides) return;
  let i = 0, timer = null, closed = false;

  const root = document.createElement('div');
  root.className = 'story';
  root.innerHTML = `
    <div class="story-bars">${slides.map(() => '<span><i></i></span>').join('')}</div>
    <button class="icon-btn story-close" aria-label="Close">${icon.close}</button>
    <div class="story-slide"></div>
    <div class="story-hint small">Tap to continue</div>`;
  document.body.append(root);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => root.classList.add('open'));

  const bars = [...root.querySelectorAll('.story-bars i')];
  const box = root.querySelector('.story-slide');

  const show = (n) => {
    if (n >= slides.length) return close();
    i = Math.max(0, n);
    const s = slides[i];
    root.dataset.theme = s.theme;
    box.innerHTML = `
      <div class="story-emoji">${s.emoji}</div>
      <p class="story-kicker">${esc(s.kicker)}</p>
      <h2 class="story-big">${esc(s.big)}</h2>
      <p class="story-sub">${esc(s.sub)}</p>`;
    box.classList.remove('in');
    void box.offsetWidth; // restart the entrance animation
    box.classList.add('in');
    bars.forEach((b, k) => {
      b.style.transition = 'none';
      b.style.width = k < i ? '100%' : '0%';
    });
    requestAnimationFrame(() => {
      bars[i].style.transition = `width ${SLIDE_MS}ms linear`;
      bars[i].style.width = '100%';
    });
    clearTimeout(timer);
    timer = setTimeout(() => show(i + 1), SLIDE_MS);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    root.classList.remove('open');
    document.body.classList.remove('sheet-open');
    setTimeout(() => root.remove(), 300);
    app.render();
  };

  root.querySelector('.story-close').onclick = (e) => { e.stopPropagation(); close(); };
  root.addEventListener('click', (e) => {
    const back = e.clientX < window.innerWidth / 3;
    show(back ? i - 1 : i + 1);
  });
  show(0);
}
