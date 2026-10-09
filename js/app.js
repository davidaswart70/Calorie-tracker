// App entry point: loads data, handles navigation between screens.
import * as store from './store.js';
import { esc, icon, toast } from './ui.js';
import * as home from './screens/home.js';
import * as items from './screens/items.js';
import * as cookbook from './screens/cookbook.js';
import * as reports from './screens/reports.js';
import * as profile from './screens/profile.js';
import * as connect from './screens/connect.js';

const SCREENS = {
  home: (main, app) => home.render(main, app),
  fridge: (main, app) => items.render(main, app, 'food'),
  bar: (main, app) => items.render(main, app, 'drink'),
  cookbook: (main, app) => cookbook.render(main, app),
  reports: (main, app) => reports.render(main, app),
  profile: (main, app) => profile.render(main, app),
};
const TABS = ['home', 'fridge', 'bar', 'cookbook', 'reports'];

const app = {
  store,
  data: null,
  screen: 'home',
  loadError: null,
  // Per-screen UI state that should survive a re-render (e.g. selected report date).
  state: {},

  go(screen) {
    location.hash = screen;
  },

  /** Reload all data from Google Sheets and redraw the current screen. */
  async refresh() {
    if (!store.getConnection()) return app.render();
    if (!app.data) showMessage('<div class="spinner"></div><p class="muted">Loading from Google Sheets…</p>');
    try {
      app.data = await store.load();
      app.loadError = null;
    } catch (err) {
      app.loadError = err.message;
      if (app.data) toast(err.message, 'error');
    }
    app.render();
  },

  render() {
    const main = document.getElementById('main');
    const connected = Boolean(store.getConnection());
    document.body.classList.toggle('no-tabbar', !connected || (!app.data && Boolean(app.loadError)));

    if (!connected) return mount(main, (el) => connect.render(el, app));
    if (!app.data && app.loadError) return showError(app.loadError);
    if (!app.data) return;
    mount(main, (el) => SCREENS[app.screen](el, app));
    updateTabbar();
  },

  disconnect() {
    store.clearConnection();
    app.data = null;
    app.render();
  },
};

function mount(main, draw) {
  main.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen';
  main.append(screen);
  draw(screen);
}

function showMessage(html) {
  mount(document.getElementById('main'), (el) => (el.innerHTML = `<section class="card glass loading">${html}</section>`));
}

function showError(message) {
  showMessage(`<p><b>Couldn’t load your data</b></p><p class="muted small">${esc(message)}</p>
    <div class="grid-2"><button class="btn" id="retry">Try again</button><button class="btn ghost" id="reconnect">Change connection</button></div>`);
  document.getElementById('retry').onclick = () => app.refresh();
  document.getElementById('reconnect').onclick = () => app.disconnect();
}

function updateTabbar() {
  const active = TABS.includes(app.screen) ? app.screen : 'home';
  const index = TABS.indexOf(active);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const on = a.dataset.tab === active;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelector('.tab-indicator').style.transform = `translateX(${index * 100}%)`;
}

function route() {
  const name = location.hash.slice(1);
  app.screen = SCREENS[name] ? name : 'home';
  window.scrollTo({ top: 0 });
  if (app.data) app.render();
}

document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon[el.dataset.icon]));
window.addEventListener('hashchange', route);
route();
app.refresh();
