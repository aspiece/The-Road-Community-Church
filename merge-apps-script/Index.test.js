const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/Index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function render(date, signups) {
  class Element {
    constructor(tag = '') {
      this.tag = tag;
      this.children = [];
      this.hidden = false;
      this.disabled = false;
      this._value = '';
      this._text = '';
    }
    set textContent(value) { this._text = value; this.children = []; }
    get textContent() { return this._text; }
    set value(value) { this._value = value; }
    get value() {
      return this.tag === 'select' && !this.children.some(child => child.value === this._value) ? '' : this._value;
    }
    get selectedIndex() { return this.children.findIndex(child => child.value === this._value); }
    appendChild(child) { this.children.push(child); }
    addEventListener() {}
  }
  const elements = {};
  for (const id of ['form', 'date', 'message', 'submit', 'cancel', 'signups', 'date-label', 'chosen-date']) {
    elements[id] = new Element(id === 'date' ? 'select' : '');
  }
  const run = {
    withSuccessHandler(handler) { this.success = handler; return this; },
    withFailureHandler(handler) { this.failure = handler; return this; },
    listSignups() { this.success(signups); }
  };
  const context = {
    document: { getElementById: id => elements[id], createElement: tag => new Element(tag) },
    google: { script: { run, url: { getLocation: fn => fn({ hash: '', parameter: date ? { date } : {} }) } } },
    Date, Intl, URLSearchParams
  };
  vm.runInNewContext(script, context);
  return elements;
}

const available = render('2027-01-03', []);
assert.equal(available.date.hidden, true);
assert.equal(available['date-label'].hidden, true);
assert.equal(available.date.value, '2027-01-03');
assert.match(available['chosen-date'].textContent, /January 3, 2027/);
assert.equal(available.submit.disabled, false);

const taken = render('2027-01-03', [{ date_iso: '2027-01-03', first_name: 'Jane' }]);
assert.equal(taken.submit.disabled, true);
assert.match(taken.message.textContent, /no longer available/);

const direct = render('', []);
assert.equal(direct.date.hidden, false);
assert.equal(direct.date.value, '');
console.log('Calendar selection, taken-date handling, and direct signup verified.');
