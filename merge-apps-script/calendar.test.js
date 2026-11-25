const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/../merge-meal-signups.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const listeners = {};
const elements = {};
for (const id of ['install-app', 'install-help', 'grid', 'err', 'debug']) {
  elements[id] = {
    textContent: '', innerHTML: '',
    addEventListener(type, handler) { listeners[id + ':' + type] = handler; }
  };
}
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-11-25T12:00:00Z'])); }
}
const popup = { closed: false, focus() {} };
let openedUrl;
let blocked = false;
let checkPopup;
let requests = 0;
const window = {
  navigator: {},
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  open(url) { openedUrl = url; return blocked ? null : popup; }
};
const document = {
  getElementById: id => elements[id],
  createElement: () => ({ remove() {} }),
  head: {
    appendChild(script) {
      requests++;
      setImmediate(() => {
        const callback = new URL(script.src).searchParams.get('callback');
        window[callback]([{ date_iso: '2027-01-03', first_name: 'Jane' }]);
      });
    }
  }
};
const context = {
  window, document, navigator: {}, console, Date: FixedDate, Promise, setTimeout, clearTimeout,
  setInterval: handler => { checkPopup = handler; return 1; }, clearInterval() {}
};
vm.createContext(context);
scripts.forEach(script => vm.runInContext(script, context));

setImmediate(() => {
  assert.match(elements.grid.innerHTML, /\?date=2027-01-10/);
  assert.doesNotMatch(elements.grid.innerHTML, /\?date=2027-01-03/);
  const href = 'https://script.google.com/macros/s/test/exec?date=2027-01-10';
  let prevented = false;
  const event = {
    button: 0, target: { closest: () => ({ href }) },
    preventDefault() { prevented = true; }
  };
  listeners['grid:click'](event);
  assert.equal(openedUrl, href);
  assert.equal(prevented, true);
  popup.closed = true;
  checkPopup();
  assert.equal(requests, 2);

  blocked = true;
  prevented = false;
  listeners['grid:click'](event);
  assert.equal(prevented, false);
  console.log('Available-date popup, fallback, and availability refresh verified.');
});
