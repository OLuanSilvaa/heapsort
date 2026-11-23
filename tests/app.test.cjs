// Lightweight DOM adapter for integration checks without browser dependencies.
// Browser layout and paint still need visual verification in a real browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag = 'div', document) {
    this.tagName = tag.toUpperCase();
    this.document = document;
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.style = { setProperty(key, value) { this[key] = value; } };
    this.listeners = {};
    this.className = '';
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.clientHeight = 385;
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); },
      toggle: (name, force) => {
        const names = this.className.split(' ').filter(Boolean);
        const add = force ?? !names.includes(name);
        this.className = [...names.filter(item => item !== name), ...(add ? [name] : [])].join(' ');
      }
    };
  }
  get firstElementChild() { return this.children[0]; }
  get lastElementChild() { return this.children.at(-1); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return (this._text || '') + this.children.map(child => child.textContent).join(''); }
  set innerHTML(html) {
    this.replaceChildren();
    for (const match of html.matchAll(/<(span|path)\b([^>]*)>/g)) {
      const child = new Element(match[1], this.document);
      child.className = /class="([^"]*)"/.exec(match[2])?.[1] || '';
      this.append(child);
    }
  }
  append(...children) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child, reference) {
    child.remove();
    child.parentElement = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index === -1) this.children.push(child); else this.children.splice(index, 0, child);
  }
  remove() {
    if (this.parentElement) {
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }
  replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  focus() { this.document.activeElement = this; }
  getBoundingClientRect() { return { x: (Number(this.dataset.index || 0) % 6) * 55, y: Math.floor(Number(this.dataset.index || 0) / 6) * 65 }; }
  getAnimations() { return []; }
  animate() { return {}; }
  fire(name, extras = {}) {
    const event = { target: this, preventDefault() {}, ...extras };
    for (const handler of this.listeners[name] || []) handler(event);
  }
  click() { if (!this.disabled) this.fire('click'); }
}

const STORAGE_KEY = 'heap-lab:state:v1';

function createApp({ storage = new Map(), storageFailure = false } = {}) {
  const elements = new Map();
  const document = {
    getElementById: id => elements.get(id),
    createElement: tag => new Element(tag, document),
    createElementNS: (_, tag) => new Element(tag, document),
    createTextNode: text => ({ textContent: String(text), remove() {} }),
    addEventListener() {}
  };
  document.documentElement = new Element('html', document);
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const element = new Element(match[1], document);
    element.value = /\bvalue="([^"]*)"/.exec(match[2])?.[1] || '';
    element.hidden = /\bhidden\b/.test(match[2]);
    elements.set(match[3], element);
  }
  elements.get('step-operation').append(new Element('span', document), new Element('code', document));
  elements.get('speed').value = '900';
  const timers = new Map();
  let nextTimer = 0;
  const storageWrites = [];
  const localStorage = {
    getItem(key) { if (storageFailure) throw new Error('Storage unavailable'); return storage.get(key) ?? null; },
    setItem(key, value) { if (storageFailure) throw new Error('Storage unavailable'); storage.set(key, value); storageWrites.push(JSON.parse(value)); }
  };
  const context = vm.createContext({ document, window: { matchMedia: () => ({ matches: false }), localStorage },
    ResizeObserver: class { observe() {} }, setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../heap-engine.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  const $ = id => elements.get(id);
  const tick = () => { const pending = timers.entries().next().value; if (pending) { const [id, fn] = pending; timers.delete(id); fn(); } };
  const finish = () => { let ticks = 0; while (timers.size) { assert.ok(ticks++ < 1000, 'animation must finish'); tick(); } };
  const submit = text => { $('values-input').value = text; $('values-form').fire('submit'); };
  const vector = () => $('vector').children.map(element => Number(element.dataset.value));
  const sync = () => assert.deepEqual($('tree-nodes').children.map(element => [element.dataset.index, element.dataset.value]), $('vector').children.map(element => [element.dataset.index, element.dataset.value]));
  const snapshot = () => JSON.parse(storage.get(STORAGE_KEY));
  return { $, finish, tick, submit, vector, sync, context, timers, document, storage, storageWrites, snapshot };
}

test('app: insertion, playback, seeking, sorting and replay keep both views synchronized', () => {
  const app = createApp();
  const { $, finish, submit, vector, sync } = app;
  assert.equal(vector().length, 9);
  sync();
  $('clear-button').click();
  assert.deepEqual(vector(), []);
  assert.equal($('empty-tree').hidden, false);
  submit('42, -18, 65, 0, 65');
  assert.equal($('values-input').disabled, true);
  $('play-button').click();
  $('next-button').click();
  assert.deepEqual(vector(), [42]);
  sync();
  $('previous-button').click();
  assert.deepEqual(vector(), []);
  $('timeline').value = $('timeline').max;
  $('timeline').fire('input');
  assert.equal(vector().length, 5, 'seeking must reach the chosen frame');
  assert.equal($('values-input').disabled, false);
  sync();
  $('sort-button').click();
  finish();
  assert.deepEqual(vector(), [-18, 0, 42, 65, 65]);
  sync();
  assert.equal($('step-heading').textContent, 'Vetor ordenado!');
  assert.equal($('sort-button').disabled, true);
  $('restart-button').click();
  assert.notDeepEqual(vector(), [-18, 0, 42, 65, 65]);
  $('play-button').click();
  finish();
  assert.deepEqual(vector(), [-18, 0, 42, 65, 65]);
  submit('100');
  finish();
  assert.equal(vector()[0], 100, 'insertion after sort restores a max-heap');
  sync();
  $('min-button').click();
  finish();
  assert.equal(vector()[0], -18);
  $('sort-button').click();
  finish();
  assert.deepEqual(vector(), [100, 65, 65, 42, 0, -18]);
  sync();
});

test('app: validation, selection, random examples, clear and empty mode changes work', () => {
  const { $, finish, submit, vector, sync, timers } = createApp();
  submit('nope');
  assert.equal($('input-error').hidden, false);
  assert.equal(vector().length, 9);
  $('clear-button').click();
  $('min-button').click();
  submit(Array(31).fill('0').join(' '));
  finish();
  assert.equal(vector().length, 31);
  assert.equal($('insert-button').disabled, true);
  assert.match($('tree-canvas').className, /dense/);
  submit('1');
  assert.equal($('input-error').hidden, false);
  assert.equal(vector().length, 31);
  $('vector').children[3].click();
  assert.match($('tree-nodes').children[3].className, /selected/);
  sync();
  $('random-button').click();
  assert.ok(timers.size > 0);
  $('clear-button').click();
  assert.equal(timers.size, 0, 'clear cancels pending playback');
  assert.deepEqual(vector(), []);
  $('random-button').click();
  finish();
  assert.equal(vector().length, 10);
  assert.equal(vector()[0], Math.min(...vector()));
  sync();
  $('help-button').click();
  assert.equal($('help-panel').hidden, false);
  $('help-button').click();
  assert.equal($('help-panel').hidden, true);
});

test('app: selection in either view exposes deletion and removes only that duplicate', () => {
  const { $, finish, submit, vector, sync, snapshot } = createApp();
  assert.equal($('selection-panel').hidden, true);
  assert.equal($('delete-button').disabled, true);
  $('clear-button').click();
  submit('42 42 18');
  finish();
  const removedId = snapshot().entries[1].id;
  $('vector').children[1].click();
  assert.equal($('selection-panel').hidden, false);
  assert.equal($('delete-button').disabled, false);
  assert.match($('selection-label').textContent, /42.*índice 1/);
  $('delete-button').click();
  finish();
  assert.deepEqual(vector().sort((a, b) => a - b), [18, 42]);
  assert.ok(!snapshot().entries.some(entry => entry.id === removedId));
  assert.equal($('selection-panel').hidden, true);
  sync();
  $('tree-nodes').children[0].click();
  assert.equal($('selection-panel').hidden, false);
  $('deselect-button').click();
  assert.equal($('selection-panel').hidden, true);
  $('tree-nodes').children[0].click();
  $('delete-button').click();
  finish();
  assert.deepEqual(vector(), [18]);
  $('vector').children[0].click();
  $('delete-button').click();
  finish();
  assert.deepEqual(vector(), []);
  assert.deepEqual(snapshot().entries, []);
  sync();
});

test('app: selection pauses a sort and deletion rebuilds from the visible frame', () => {
  const { $, finish, tick, vector, sync, timers, snapshot } = createApp();
  $('sort-button').click();
  while (snapshot().frames[snapshot().cursor].kind !== 'swap') tick();
  const visibleValues = vector();
  const removedId = snapshot().entries[2].id;
  $('tree-nodes').children[2].click();
  assert.equal(timers.size, 0);
  assert.deepEqual(vector(), visibleValues);
  $('delete-button').click();
  finish();
  const expected = [...visibleValues];
  expected.splice(2, 1);
  assert.deepEqual(vector().sort((a, b) => a - b), expected.sort((a, b) => a - b));
  assert.ok(!snapshot().entries.some(entry => entry.id === removedId));
  assert.equal(vector().length, visibleValues.length - 1);
  assert.equal(snapshot().frames.at(-1).title, 'Exclusão concluída');
  sync();
});

test('app: every visible sort step is saved before completion and restored paused', () => {
  const app = createApp();
  const { $, tick, vector, sync, storage, snapshot, storageWrites } = app;
  $('speed').value = '450';
  $('speed').fire('change');
  $('sort-button').click();
  const writesAtStart = storageWrites.length;
  for (let i = 0; i < 5; i++) {
    tick();
    assert.equal(storageWrites.length, writesAtStart + i + 1);
    assert.equal(snapshot().cursor, i + 1);
    assert.deepEqual(snapshot().entries.map(entry => entry.value), vector());
    assert.ok(snapshot().cursor < snapshot().frames.length - 1, 'persistence must not wait for the final frame');
    sync();
  }
  for (let i = 0; i < 100 && snapshot().frames[snapshot().cursor].kind !== 'swap'; i++) tick();
  assert.equal(snapshot().frames[snapshot().cursor].kind, 'swap');
  assert.deepEqual(snapshot().entries.map(entry => entry.value), vector(), 'a swap must be saved as soon as it is displayed');
  assert.notDeepEqual(vector(), [90, 75, 80, 40, 60, 55, 65, 20, 35]);
  const beforeReload = snapshot();
  const restored = createApp({ storage });
  assert.deepEqual(restored.vector(), vector());
  assert.equal(restored.snapshot().cursor, beforeReload.cursor);
  assert.equal(restored.$('speed').value, '450');
  assert.equal(restored.timers.size, 0, 'reload must pause the unfinished demonstration');
  assert.equal(restored.$('timeline').value, beforeReload.cursor);
  restored.sync();
  restored.$('next-button').click();
  assert.equal(restored.snapshot().cursor, beforeReload.cursor + 1);
  restored.$('previous-button').click();
  assert.equal(restored.snapshot().cursor, beforeReload.cursor);
  restored.$('timeline').value = 2;
  restored.$('timeline').fire('input');
  assert.equal(restored.snapshot().cursor, 2);
  restored.$('play-button').click();
  restored.finish();
  assert.deepEqual(restored.vector(), [20, 35, 40, 55, 60, 65, 75, 80, 90]);
  const sortedReload = createApp({ storage });
  assert.deepEqual(sortedReload.vector(), restored.vector());
  assert.equal(sortedReload.$('step-heading').textContent, 'Vetor ordenado!');
  sortedReload.submit('101');
  sortedReload.finish();
  const ids = sortedReload.snapshot().entries.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'restored IDs must not collide with new insertions');
});

test('app: reload preserves min-heap, deletion progress, selection and an empty tree', () => {
  const app = createApp();
  app.$('min-button').click();
  app.finish();
  app.$('vector').children[3].click();
  let restored = createApp({ storage: app.storage });
  assert.equal(restored.$('min-button').getAttribute('aria-pressed'), 'true');
  assert.equal(restored.$('selection-panel').hidden, false);
  restored.$('delete-button').click();
  while (restored.snapshot().frames[restored.snapshot().cursor].kind !== 'remove') restored.tick();
  assert.equal(restored.vector().length, 8);
  restored = createApp({ storage: app.storage });
  assert.equal(restored.vector().length, 8);
  restored.$('play-button').click();
  restored.finish();
  restored.sync();
  assert.equal(restored.vector()[0], Math.min(...restored.vector()));
  restored.$('clear-button').click();
  const clearedReload = createApp({ storage: app.storage });
  assert.deepEqual(clearedReload.vector(), []);
  assert.equal(clearedReload.$('empty-tree').hidden, false);
});

test('app: unavailable or corrupted storage does not break editing', () => {
  for (const options of [{ storageFailure: true }, { storage: new Map([[STORAGE_KEY, '{invalid json']]) }, { storage: new Map([[STORAGE_KEY, JSON.stringify({ version: 1, mode: 'max', cursor: 500, frames: [] })]]) }]) {
    const { $, vector, submit, finish } = createApp(options);
    assert.equal(vector().length, 9);
    $('clear-button').click();
    submit('3 1 2');
    finish();
    assert.equal(vector()[0], 3);
    if (options.storageFailure) assert.equal($('storage-status').textContent, 'Salvamento indisponível');
  }
});
