// Data storage: Google Sheets, through the Apps Script web app in apps-script/Code.gs.
//
// The web app URL and passcode are entered in the app and kept on this device only
// (never in the code). Every write is confirmed by the spreadsheet, and each response
// carries all data, so the app always shows what is actually in the sheet.

const CONFIG_KEY = 'calorie-tracker-connection';

// ---------- Connection settings (this device only) ----------

export function getConnection() {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
    return c && c.url && c.passcode ? c : null;
  } catch {
    return null;
  }
}

export function setConnection(url, passcode) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: url.trim(), passcode }));
}

export function clearConnection() {
  try { localStorage.removeItem(CONFIG_KEY); } catch { /* ignore */ }
  latest = null;
}

// ---------- Requests ----------

let latest = null; // data from the most recent successful response

async function call(action, params = {}, conn = getConnection()) {
  if (!conn) throw new Error('Not connected to Google Sheets.');
  const isWrite = action !== 'load';
  let res;
  try {
    // A plain-text body keeps this a "simple" request, which Apps Script accepts from any site.
    res = await fetch(conn.url, { method: 'POST', body: JSON.stringify({ passcode: conn.passcode, action, ...params }) });
  } catch {
    throw new Error(isWrite
      ? 'Could not reach Google Sheets, so the save was not confirmed. Check your connection, then reopen the app to see what was saved.'
      : 'Could not reach Google Sheets. Check your internet connection.');
  }
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(isWrite
      ? 'Google Sheets sent an unexpected reply, so the save was not confirmed. Reopen the app to see what was saved.'
      : 'Google Sheets sent an unexpected reply. Check the web app URL.');
  }
  if (!body.ok) throw new Error(isWrite ? `Not saved: ${body.error}` : body.error);
  latest = body.data;
  return body;
}

/** Check a URL + passcode before saving them. */
export async function testConnection(url, passcode) {
  await call('load', {}, { url: url.trim(), passcode });
}

// ---------- Data API used by the screens ----------

/** All data. Uses the data returned by the last write if there is one, otherwise fetches. */
export async function load() {
  if (latest) {
    const data = latest;
    latest = null;
    return data;
  }
  const body = await call('load');
  latest = null;
  return body.data;
}

export async function add(table, row) {
  return (await call('add', { table, row })).row;
}

export async function update(table, id, row) {
  return (await call('update', { table, id, row })).row;
}

export async function remove(table, id) {
  await call('remove', { table, id });
}

/** Save a recipe or drink together with its ingredients in one request. `id` is null for new items. */
export async function saveWithIngredients(table, id, row, parentType, list) {
  return (await call('saveWithIngredients', { table, id, row, parentType, list })).row;
}

/** Save a weight; replaces any existing entry for the same date. */
export async function saveWeight(date, weightKg) {
  return (await call('saveWeight', { date, weightKg })).row;
}

export async function saveSettings(values) {
  await call('saveSettings', { values });
}
