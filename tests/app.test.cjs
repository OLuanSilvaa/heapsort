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

function createApp() {
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
  const context = vm.createContext({ document, window: { matchMedia: () => ({ matches: false }) },
    ResizeObserver: class { observe() {} }, setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../heap-engine.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  const $ = id => elements.get(id);
  const finish = () => { let ticks = 0; while (timers.size) { assert.ok(ticks++ < 1000, 'animation must finish'); const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); } };
  const submit = text => { $('values-input').value = text; $('values-form').fire('submit'); };
  const vector = () => $('vector').children.map(element => Number(element.dataset.value));
  const sync = () => assert.deepEqual($('tree-nodes').children.map(element => [element.dataset.index, element.dataset.value]), $('vector').children.map(element => [element.dataset.index, element.dataset.value]));
  return { $, finish, submit, vector, sync, context, timers, document };
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
