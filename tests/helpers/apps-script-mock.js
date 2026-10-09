// A small in-memory stand-in for the Google Apps Script services that apps-script/Code.gs uses,
// so the backend can be tested with Node (and run locally for end-to-end testing).
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = []; // 2D array of cell values
  }
  getName() { return this.name; }
  getLastRow() {
    for (let r = this.rows.length; r > 0; r--) if ((this.rows[r - 1] || []).some((v) => v !== '' && v != null)) return r;
    return 0;
  }
  getLastColumn() {
    return this.rows.reduce((m, row) => {
      let last = 0;
      row.forEach((v, i) => { if (v !== '' && v != null) last = i + 1; });
      return Math.max(m, last);
    }, 0);
  }
  getMaxRows() { return 1000; }
  setFrozenRows() {}
  getRange(row, col, numRows = 1, numCols = 1) { return new Range(this, row, col, numRows, numCols); }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  cell(r, c) { return (this.rows[r - 1] || [])[c - 1] ?? ''; }
  set(r, c, v) {
    while (this.rows.length < r) this.rows.push([]);
    const row = this.rows[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = v;
  }
}

class Range {
  constructor(sheet, row, col, numRows, numCols) { Object.assign(this, { sheet, row, col, numRows, numCols }); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) row.push(this.sheet.cell(this.row + r, this.col + c));
      out.push(row);
    }
    return out;
  }
  setValues(values) {
    values.forEach((row, r) => row.forEach((v, c) => this.sheet.set(this.row + r, this.col + c, v)));
    return this;
  }
  setValue(v) { this.sheet.set(this.row, this.col, v); return this; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
}

class Spreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const s = new Sheet(name); this.sheets.set(name, s); return s; }
}

/** Load Code.gs with mocked services. Returns { post(body), get(), ss, props }. */
export function loadBackend({ passcode = 'secret', codePath = new URL('../../apps-script/Code.gs', import.meta.url) } = {}) {
  const ss = new Spreadsheet();
  const props = { PASSCODE: passcode };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content) => ({ content, setMimeType() { return this; } }),
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d) => d.toISOString().slice(0, 10),
    },
    Session: { getScriptTimeZone: () => 'UTC' },
    Logger: { log: () => {} },
  });
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), context);
  return {
    ss,
    props,
    post: (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).content),
    get: () => JSON.parse(context.doGet().content),
    setup: () => context.setup(),
  };
}
