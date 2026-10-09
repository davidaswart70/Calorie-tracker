/**
 * Calorie Tracker — Google Sheets backend (Google Apps Script web app).
 *
 * Paste this whole file into Extensions → Apps Script of your spreadsheet.
 * Setup steps are in the README ("Connecting Google Sheets").
 *
 * The app sends POST requests with a JSON body: { passcode, action, ...params }.
 * Every write is read back from the sheet before success is reported,
 * and the response includes all data so the app is always showing what's in the sheet.
 */

// Table name used by the app → tab name and columns in the spreadsheet.
const TABLES = {
  foods: { tab: 'Foods', cols: ['id', 'name', 'unit', 'servingSize', 'kcal', 'protein', 'carbs', 'fat', 'source', 'notes', 'updatedAt'] },
  drinks: { tab: 'Drinks', cols: ['id', 'name', 'unit', 'servingSize', 'kcal', 'protein', 'carbs', 'fat', 'source', 'notes', 'updatedAt'] },
  recipes: { tab: 'Recipes', cols: ['id', 'name', 'servings', 'notes', 'updatedAt'] },
  ingredients: { tab: 'Recipe Ingredients', cols: ['id', 'parentType', 'parentId', 'itemType', 'itemId', 'quantity', 'unit'] },
  logs: { tab: 'Daily Logs', cols: ['id', 'date', 'time', 'type', 'itemId', 'name', 'quantity', 'unit', 'kcal', 'protein', 'carbs', 'fat', 'source', 'createdAt'] },
  weights: { tab: 'Weight Logs', cols: ['id', 'date', 'weightKg', 'createdAt'] },
};
const SETTINGS_TAB = 'Settings';

// ---------- Entry points ----------

/** Run this once from the Apps Script editor to create all tabs. */
function setup() {
  ensureTabs_();
  const pass = PropertiesService.getScriptProperties().getProperty('PASSCODE');
  Logger.log(pass ? 'Tabs are ready.' : 'Tabs are ready. Now add a PASSCODE script property (Project Settings → Script properties).');
}

/** Opening the web app URL in a browser just confirms it's running. */
function doGet() {
  return json_({ ok: true, message: 'Calorie Tracker API is running. Use the app to connect.' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Invalid request.' });
  }

  const expected = PropertiesService.getScriptProperties().getProperty('PASSCODE');
  if (!expected) return json_({ ok: false, error: 'No PASSCODE is set up in the Apps Script project settings.' });
  if (String(req.passcode || '') !== expected) return json_({ ok: false, error: 'Wrong passcode.' });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'The spreadsheet is busy. Nothing was saved — please try again.' });
  }

  try {
    ensureTabs_();
    const result = handle_(req);
    SpreadsheetApp.flush();
    return json_(Object.assign({ ok: true, data: readAll_() }, result || {}));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function handle_(req) {
  switch (req.action) {
    case 'load':
      return {};
    case 'add':
      return { row: addRow_(req.table, req.row) };
    case 'update':
      return { row: updateRow_(req.table, req.id, req.row) };
    case 'remove':
      removeRow_(req.table, req.id);
      return {};
    case 'setIngredients':
      setIngredients_(req.parentType, req.parentId, req.list || []);
      return {};
    case 'saveWithIngredients': {
      const row = req.id ? updateRow_(req.table, req.id, req.row) : addRow_(req.table, req.row);
      setIngredients_(req.parentType, row.id, req.list || []);
      return { row: row };
    }
    case 'saveWeight':
      return { row: saveWeight_(req.date, req.weightKg) };
    case 'saveSettings':
      saveSettings_(req.values || {});
      return {};
    default:
      throw new Error('Unknown action: ' + req.action);
  }
}

// ---------- Sheet helpers ----------

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function table_(name) {
  const t = TABLES[name];
  if (!t) throw new Error('Unknown table: ' + name);
  return t;
}

/** Create any missing tabs with headers. All cells are plain text so dates stay as typed. */
function ensureTabs_() {
  const ss = ss_();
  const make = function (tab, cols) {
    let sh = ss.getSheetByName(tab);
    if (!sh) {
      sh = ss.insertSheet(tab);
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    }
    return sh;
  };
  Object.keys(TABLES).forEach(function (k) { make(TABLES[k].tab, TABLES[k].cols); });
  make(SETTINGS_TAB, ['key', 'value']);
}

function sheet_(name) {
  return ss_().getSheetByName(table_(name).tab);
}

/** Header row → column index map (columns are matched by header name, so order doesn't matter). */
function headers_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const row = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  row.forEach(function (h, i) { if (h !== '') map[String(h).trim()] = i; });
  return map;
}

function cell_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}

function readTable_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const map = headers_(sh);
  const cols = table_(name).cols;
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (map.id === undefined || row[map.id] === '' || row[map.id] == null) continue;
    const obj = {};
    cols.forEach(function (c) { obj[c] = map[c] === undefined ? '' : cell_(row[map[c]]); });
    obj.id = String(obj.id);
    out.push(obj);
  }
  return out;
}

function readSettings_() {
  const sh = ss_().getSheetByName(SETTINGS_TAB);
  const values = sh.getDataRange().getValues();
  const out = {};
  for (let r = 1; r < values.length; r++) {
    if (values[r][0] !== '') out[String(values[r][0])] = String(cell_(values[r][1]));
  }
  return out;
}

function readAll_() {
  const data = { settings: readSettings_() };
  Object.keys(TABLES).forEach(function (k) { data[k] = readTable_(k); });
  return data;
}

/** Find the sheet row number (1-based) for an id, or -1. */
function findRow_(sh, id) {
  const map = headers_(sh);
  const last = sh.getLastRow();
  if (last < 2 || map.id === undefined) return -1;
  const ids = sh.getRange(2, map.id + 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function rowValues_(sh, name, obj) {
  const map = headers_(sh);
  const width = Math.max(sh.getLastColumn(), table_(name).cols.length);
  const arr = new Array(width).fill('');
  Object.keys(obj).forEach(function (k) {
    if (map[k] !== undefined) arr[map[k]] = obj[k] == null ? '' : String(obj[k]);
  });
  return arr;
}

function clean_(name, row) {
  const out = {};
  table_(name).cols.forEach(function (c) { if (row && c in row) out[c] = row[c]; });
  return out;
}

function now_() {
  return new Date().toISOString();
}

function readBack_(name, id) {
  const row = readTable_(name).find(function (r) { return r.id === String(id); });
  if (!row) throw new Error('The save could not be confirmed in the spreadsheet.');
  return row;
}

function addRow_(name, row) {
  const sh = sheet_(name);
  const cols = table_(name).cols;
  const obj = clean_(name, row);
  obj.id = Utilities.getUuid().slice(0, 13);
  if (cols.indexOf('updatedAt') >= 0) obj.updatedAt = now_();
  if (cols.indexOf('createdAt') >= 0) obj.createdAt = now_();
  const values = rowValues_(sh, name, obj);
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, values.length).setNumberFormat('@').setValues([values]);
  return readBack_(name, obj.id);
}

function updateRow_(name, id, changes) {
  const sh = sheet_(name);
  const r = findRow_(sh, id);
  if (r < 0) throw new Error('That item no longer exists in the spreadsheet.');
  const map = headers_(sh);
  const obj = clean_(name, changes);
  delete obj.id;
  if (table_(name).cols.indexOf('updatedAt') >= 0) obj.updatedAt = now_();
  Object.keys(obj).forEach(function (k) {
    if (map[k] !== undefined) sh.getRange(r, map[k] + 1).setNumberFormat('@').setValue(obj[k] == null ? '' : String(obj[k]));
  });
  return readBack_(name, id);
}

function removeRow_(name, id) {
  const sh = sheet_(name);
  const r = findRow_(sh, id);
  if (r < 0) throw new Error('That item no longer exists in the spreadsheet.');
  sh.deleteRow(r);
  if (name === 'recipes' || name === 'drinks') setIngredients_(name === 'recipes' ? 'recipe' : 'drink', id, []);
  if (findRow_(sh, id) > 0) throw new Error('The delete could not be confirmed in the spreadsheet.');
}

function setIngredients_(parentType, parentId, list) {
  const sh = sheet_('ingredients');
  const map = headers_(sh);
  const last = sh.getLastRow();
  if (last >= 2) {
    const values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    // Delete from the bottom up so row numbers stay valid.
    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i][map.parentType]) === String(parentType) && String(values[i][map.parentId]) === String(parentId)) {
        sh.deleteRow(i + 2);
      }
    }
  }
  list.forEach(function (ing) {
    addRow_('ingredients', Object.assign({}, ing, { parentType: parentType, parentId: parentId }));
  });
}

function saveWeight_(date, weightKg) {
  const existing = readTable_('weights').find(function (w) { return w.date === String(date); });
  return existing
    ? updateRow_('weights', existing.id, { weightKg: weightKg })
    : addRow_('weights', { date: date, weightKg: weightKg });
}

function saveSettings_(values) {
  const sh = ss_().getSheetByName(SETTINGS_TAB);
  const last = sh.getLastRow();
  const keys = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  Object.keys(values).forEach(function (k) {
    const v = values[k] == null ? '' : String(values[k]);
    const i = keys.indexOf(k);
    if (i >= 0) {
      sh.getRange(i + 2, 2).setNumberFormat('@').setValue(v);
    } else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setNumberFormat('@').setValues([[k, v]]);
      keys.push(k);
    }
  });
  const saved = readSettings_();
  Object.keys(values).forEach(function (k) {
    if (saved[k] !== (values[k] == null ? '' : String(values[k]))) throw new Error('Settings could not be confirmed in the spreadsheet.');
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
