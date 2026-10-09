// App entry point: loads data, handles navigation between screens.
import * as store from './store.js';
import { icon, toast } from './ui.js';
import * as home from './screens/home.js';
import * as items from './screens/items.js';
import * as cookbook from './screens/cookbook.js';
import * as reports from './screens/reports.js';
import * as profile from './screens/profile.js';

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
  // Per-screen UI state that should survive a re-render (e.g. selected report date).
  state: {},

  go(screen) {
    location.hash = screen;
  },

  /** Reload all data from storage and redraw the current screen. */
  async refresh() {
    try {
      app.data = await store.load();
    } catch (err) {
      toast(`Could not load your data: ${err.message}`, 'error');
      app.data ??= { foods: [], drinks: [], recipes: [], ingredients: [], logs: [], weights: [], settings: {} };
    }
    app.render();
  },

  render() {
    const main = document.getElementById('main');
    main.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    main.append(screen);
    SCREENS[app.screen](screen, app);
    updateTabbar();
  },
};

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
