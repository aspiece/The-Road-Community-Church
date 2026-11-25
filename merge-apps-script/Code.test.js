const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

const realDate = Date;
class TestDate extends realDate {
  constructor(...args) {
    super(...(args.length ? args : ['2026-11-25T14:00:00Z']));
  }
  static now() { return new realDate('2026-11-25T14:00:00Z').getTime(); }
}

const data = [
  ['date_iso', 'date_nice', 'name', 'timestamp', '', '', ''],
  ['2026-12-06', 'Sunday', 'Legacy Person', new TestDate(), '', '', '']
];
const properties = new Map([
  ['TOKEN_SECRET', 'a'.repeat(64)],
  ['APP_URL', 'https://script.google.com/macros/s/test-deployment/exec'],
  ['COORDINATOR_EMAIL', 'coordinator@example.com']
]);
const sent = [];
const events = new Map();
let calendarFails = false;
let mailFails = false;
let nextUuid = 0;
const sheet = {
  getLastRow: () => data.length,
  getRange(row, column, height = 1, width = 1) {
    return {
      getValues: () => data.slice(row - 1, row - 1 + height)
        .map(values => Array.from({ length: width }, (_, i) => values[column - 1 + i] || '')),
      setValues(values) {
        values.forEach((valueRow, r) => valueRow.forEach((value, c) => {
          if (!data[row - 1 + r]) data[row - 1 + r] = [];
          data[row - 1 + r][column - 1 + c] = value;
        }));
      },
      setValue(value) { data[row - 1][column - 1] = value; }
    };
  },
  appendRow(row) { data.push(row); },
  deleteRow(row) { data.splice(row - 1, 1); }
};
const scriptProperties = {
  getProperty: key => properties.get(key) || null,
  setProperty: (key, value) => properties.set(key, value),
  deleteProperty: key => properties.delete(key),
  getProperties: () => Object.fromEntries(properties)
};
const context = {
  Date: TestDate, console: { error() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({
    getSheetByName: () => sheet, getSheets: () => [sheet]
  }) },
  PropertiesService: { getScriptProperties: () => scriptProperties },
  Utilities: {
    getUuid: () => String(++nextUuid).padStart(32, '0'),
    computeHmacSha256Signature: (value, key) => crypto.createHmac('sha256', key).update(value).digest(),
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
    formatDate(date, timezone, format) {
      if (format === 'yyyy-MM-dd') {
        return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric',
          month: '2-digit', day: '2-digit' }).format(date);
      }
      return date.toISOString().slice(0, 10);
    }
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://example.test/exec' }) },
  ContentService: {
    MimeType: { JAVASCRIPT: 'javascript', JSON: 'json' },
    createTextOutput: text => ({ text, setMimeType(type) { this.type = type; return this; } })
  },
  Calendar: { Events: {
    get(calendar, id) {
      if (calendarFails) throw new Error('Calendar unavailable');
      if (!events.has(id)) throw new Error('404 Not Found');
      return events.get(id);
    },
    insert(event, calendar, options) {
      assert.equal(options.sendUpdates, 'all');
      events.set(event.id, event);
    },
    patch(event, calendar, id, options) {
      assert.equal(options.sendUpdates, 'all');
      events.set(id, { ...event, id });
    },
    remove(calendar, id, options) {
      assert.equal(options.sendUpdates, 'all');
      if (calendarFails) throw new Error('Calendar unavailable');
      if (!events.delete(id)) throw new Error('404 Not Found');
    }
  } },
  MailApp: {
    getRemainingDailyQuota: () => 100,
    sendEmail(email) {
      if (mailFails) throw new Error('Mail unavailable');
      sent.push(email);
    }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), context);

function tokenFromLastMail() {
  return sent.at(-1).body.match(/#manage=([A-Za-z0-9_-]+)/)[1];
}

assert.deepEqual(JSON.parse(JSON.stringify(context.listSignups())),
  [{ date_iso: '2026-12-06', first_name: 'Legacy' }]);
const publicList = context.doGet({ parameter: { action: 'list', callback: 'callback_1' } }).text;
assert.match(publicList, /^callback_1\(/);
assert.doesNotMatch(publicList, /Legacy Person|email|timestamp/);
assert.equal(context.doGet({ parameter: { action: 'list', callback: 'alert(1)' } }).text, 'Invalid callback');
assert.match(context.doPost().text, /updated signup page/);
assert.equal(context.createSignup({ date: '2026-11-29', name: 'Jane Smith', email: 'jane@example.com' }).calendarSent, true);
let event = [...events.values()][0];
assert.equal(event.start.dateTime, '2026-11-29T17:45:00');
assert.equal(event.end.dateTime, '2026-11-29T18:00:00');
assert.equal(event.start.timeZone, 'America/Detroit');
assert.deepEqual(Array.from(event.attendees, a => a.email), ['jane@example.com', 'coordinator@example.com']);
assert.equal(event.guestsCanSeeOtherGuests, false);
let token = tokenFromLastMail();
assert.equal(context.getSignup(token).name, 'Jane Smith');
assert.equal(context.listSignups()[1].first_name, 'Jane');
assert.throws(() => context.createSignup({ date: '2026-11-29', name: 'Other', email: 'o@example.com' }), /taken/);
assert.throws(() => context.createSignup({ date: '2026-11-30', name: 'Other', email: 'o@example.com' }), /Sunday/);
assert.throws(() => context.getSignup('invalid'), /invalid or has expired/);

const updated = context.updateSignup(token, {
  date: '2026-12-13', name: 'Jane Jones', email: 'new@example.com'
});
assert.notEqual(updated.token, token);
assert.equal(updated.calendarSent, true);
event = [...events.values()][0];
assert.equal(event.start.dateTime, '2026-12-13T17:45:00');
assert.deepEqual(Array.from(event.attendees, a => a.email), ['new@example.com', 'coordinator@example.com']);
assert.throws(() => context.getSignup(token), /invalid or has expired/);
token = updated.token;
assert.equal(context.getSignup(token).email, 'new@example.com');
assert.throws(() => context.updateSignup(token, {
  date: '2026-12-06', name: 'Jane Jones', email: 'new@example.com'
}), /taken/);
mailFails = true;
assert.throws(() => context.updateSignup(token, {
  date: '2026-12-20', name: 'Jane Jones', email: 'new@example.com'
}), /not changed/);
assert.equal(context.getSignup(token).date, '2026-12-13');
assert.throws(() => context.createSignup({
  date: '2026-12-20', name: 'Other', email: 'o@example.com'
}), /not saved/);
mailFails = false;
calendarFails = true;
assert.throws(() => context.cancelSignup(token), /not canceled/);
assert.equal(context.getSignup(token).date, '2026-12-13');
calendarFails = false;
assert.equal(context.cancelSignup(token).emailSent, true);
assert.equal(events.size, 0);
assert.throws(() => context.getSignup(token), /invalid or has expired/);
assert.equal(data.length, 2);

context.createSignup({ date: '2026-11-29', name: 'Reminder Person', email: 'r@example.com' });
// Three days before Sunday, at 9 a.m. Eastern.
TestDate.now = () => new realDate('2026-11-26T14:00:00Z').getTime();
const previous = sent.length;
context.sendReminders_();
context.sendReminders_();
assert.equal(sent.length, previous + 1);
TestDate.now = () => new realDate('2026-11-28T14:00:00Z').getTime();
context.sendReminders_();
context.sendReminders_();
assert.equal(sent.length, previous + 2);

calendarFails = true;
assert.equal(context.createSignup({ date: '2026-12-20', name: 'Another Person', email: 'another@example.com' }).calendarSent, false);
calendarFails = false;
console.log('Apps Script signup, privacy, management, rollback, and reminder checks passed.');
