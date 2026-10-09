// Connect to the Google Sheets web app (URL + passcode, saved on this device only).
import { esc, saving } from '../ui.js';

const README = 'https://github.com/davidaswart70/Calorie-tracker#connecting-google-sheets';

export function render(el, app) {
  const conn = app.store.getConnection();
  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Calorie Tracker</p><h1>Connect Google Sheets</h1></div></header>
    <section class="card glass stack">
      <p class="small muted" style="margin:0">Your foods, drinks, recipes and logs are stored in your own Google Sheet.
        Enter the web app URL and passcode from the setup steps. They are saved on this device only.</p>
      <label class="field"><span>Web app URL</span>
        <input class="input" id="url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="https://script.google.com/macros/s/…/exec" value="${esc(conn?.url || '')}"></label>
      <label class="field"><span>Passcode</span>
        <input class="input" id="pass" type="password" autocomplete="current-password" value=""></label>
      <button class="btn block" id="connect">Connect</button>
      <p class="tiny" style="margin:0">Need the setup steps? <a href="${README}" target="_blank" rel="noopener">See “Connecting Google Sheets” in the README</a>.</p>
    </section>`;

  const url = el.querySelector('#url');
  const pass = el.querySelector('#pass');
  el.querySelector('#connect').onclick = async (e) => {
    const u = url.value.trim();
    if (!u) return url.focus();
    if (!pass.value) return pass.focus();
    const res = await saving(e.currentTarget, () => app.store.testConnection(u, pass.value), 'Connected to Google Sheets');
    if (res.ok) {
      app.store.setConnection(u, pass.value);
      app.go('home');
      app.refresh();
    }
  };
}
