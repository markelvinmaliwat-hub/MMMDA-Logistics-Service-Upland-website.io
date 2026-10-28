/**
 * MMMDA Logistics / PLDT dashboard backend  ->  your Google Sheet
 *
 * Tabs created automatically in the spreadsheet:
 *   Activity_Log  - every login / search / view the dashboard records
 *   Payment_Log   - every "For payment" update (full history)
 *   Accounts      - sign-ups, so agents can log in from ANY device
 *
 * Deploy as: Web app  |  Execute as: Me  |  Who has access: Anyone
 */
const SHEET_ID = '11-VVgEX5ugFP4suckiaV_LitXz2VhuYe3HhDv4rLcdA';
const TZ = 'Asia/Manila';
const MAX_ACTIVITY_READ = 5000;   // newest rows sent back to the Activity log screen
const MAX_PAY_READ = 20000;

const TABS = {
  activity: { name: 'Activity_Log', headers: ['Time', 'Email', 'Agent Code', 'Agent Name', 'Action', 'Where', 'Search / Details', 'Device', 'Visitor ID'] },
  pay:      { name: 'Payment_Log',  headers: ['Saved At', 'Key', 'Subscriber', 'Account', 'Agent', 'Action', 'Action Label', 'Date of Payment', 'Remarks', 'Saved By (email)', 'Agent Code', 'Saved By (name)'] },
  acct:     { name: 'Accounts',     headers: ['Email', 'Password Hash', 'Created'] }
};

/* Run this ONCE from the editor (Run > setup) to create the tabs and grant permissions. */
function setup() {
  Object.keys(TABS).forEach(function (k) { sheet_(TABS[k]); });
}

/* ---------- helpers ---------- */
function sheet_(tab) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(tab.name);
  if (!sh) {
    sh = ss.insertSheet(tab.name);
    sh.getRange(1, 1, 1, tab.headers.length).setNumberFormat('@').setValues([tab.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function clean_(v, max) {
  return String(v == null ? '' : v).slice(0, max || 1000);
}
function s_(v) {                       // sheet cell -> plain text (undo any auto date conversion)
  if (v instanceof Date) {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss').replace(' 00:00:00', '');
  }
  return String(v == null ? '' : v);
}
function append_(tab, values) {        // always stored as TEXT, so "=formula" typed by a user can never run
  const sh = sheet_(tab);
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, values.length).setNumberFormat('@').setValues([values]);
}
function lastRows_(tab, max) {
  const sh = sheet_(tab), last = sh.getLastRow();
  if (last < 2) return [];
  const start = Math.max(2, last - max + 1);
  return sh.getRange(start, 1, last - start + 1, tab.headers.length).getValues();
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- writes (dashboard POSTs) ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.type === 'pay') {
      append_(TABS.pay, [
        clean_(d.at, 40), clean_(d.key, 300), clean_(d.name, 200), clean_(d.account, 100), clean_(d.agent, 200),
        clean_(d.action, 40), clean_(d.label, 200), clean_(d.date, 40), clean_(d.remarks, 500),
        clean_(d.by, 200), clean_(d.code, 40), clean_(d.byName, 200)
      ]);
    } else {
      append_(TABS.activity, [
        clean_(d.time, 40), clean_(d.email, 200), clean_(d.code, 40), clean_(d.name, 200),
        clean_(d.action, 100), clean_(d.where, 300), clean_(d.search, 600), clean_(d.device, 200), clean_(d.visitor, 60)
      ]);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------- reads + accounts (dashboard GETs) ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.acct) return json_(account_(p));

    if (p.read === '1') {
      return json_({ rows: lastRows_(TABS.activity, MAX_ACTIVITY_READ).map(function (r) {
        return { time: s_(r[0]), email: s_(r[1]), code: s_(r[2]), name: s_(r[3]), action: s_(r[4]),
                 where: s_(r[5]), search: s_(r[6]), device: s_(r[7]), visitor: s_(r[8]) };
      }) });
    }

    if (p.read === 'pay' || p.read === 'payhist') {
      const rows = lastRows_(TABS.pay, MAX_PAY_READ).map(payObj_);
      if (p.read === 'payhist') {
        rows.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
        return json_({ rows: rows.slice(0, 1000) });
      }
      const latest = {};               // newest update per subscriber
      rows.forEach(function (x) {
        if (!x.key) return;
        if (!latest[x.key] || x.at >= latest[x.key].at) latest[x.key] = x;
      });
      return json_({ rows: Object.keys(latest).map(function (k) { return latest[k]; }) });
    }

    return json_({ ok: true, status: 'Dashboard backend is running' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
function payObj_(r) {
  return { at: s_(r[0]), key: s_(r[1]), name: s_(r[2]), account: s_(r[3]), agent: s_(r[4]),
           action: s_(r[5]), label: s_(r[6]), date: s_(r[7]), remarks: s_(r[8]),
           by: s_(r[9]), code: s_(r[10]), byName: s_(r[11]) };
}

/* ---------- accounts: acct=create | login  (the password hash is never sent back) ---------- */
function account_(p) {
  const op = String(p.acct), email = String(p.email || '').trim().toLowerCase(), h = String(p.h || '');
  if (!email || email.indexOf('@') < 0) return { ok: false, reason: 'email' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(TABS.acct), last = sh.getLastRow();
    let found = null;
    if (last >= 2) {
      const vals = sh.getRange(2, 1, last - 1, 2).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][0]).toLowerCase() === email) { found = String(vals[i][1]); break; }
      }
    }
    if (op === 'create') {
      if (found !== null) return { ok: false, exists: true };
      if (!h) return { ok: false, reason: 'hash' };
      append_(TABS.acct, [email, h, Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss')]);
      return { ok: true };
    }
    if (op === 'login') {
      if (found === null) return { ok: false, reason: 'none' };
      return found === h ? { ok: true } : { ok: false, reason: 'bad' };
    }
    return { ok: false, reason: 'op' };
  } finally {
    lock.releaseLock();
  }
}
