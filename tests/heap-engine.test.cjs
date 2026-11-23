const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../heap-engine.js');
const { parseValues, buildFrames, insertFrames, deleteFrames, sortFrames, isHeap } = globalThis.HeapEngine;
const entries = values => values.map((value, id) => ({ value, id }));
const values = frame => frame.entries.map(entry => entry.value);

test('input accepts integers, negatives, zero, duplicates and mixed separators', () => {
  assert.deepEqual(parseValues(' 42, -18; 0\n+65 42 '), [42, -18, 0, 65, 42]);
  for (const invalid of ['', '   ', '1.5', '1e3', 'abc', '4, x', 'NaN', '100000', '-100000', '9007199254740993']) {
    assert.throws(() => parseValues(invalid));
  }
  assert.throws(() => parseValues('1 2', 30));
  assert.equal(parseValues(Array(31).fill('0').join(' ')).length, 31);
});

for (const mode of ['max', 'min']) {
  test(`${mode}: iterative build and sort preserve values and element identities`, () => {
    const samples = [[], [0], [2, 1], [5, 5, 5], [-5, 0, 3, -10, 2], Array.from({ length: 31 }, (_, i) => i - 15), Array.from({ length: 31 }, (_, i) => 15 - i)];
    let seed = 42;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let sample = 0; sample < 80; sample++) samples.push(Array.from({ length: random() % 32 }, () => random() % 199 - 99));
    for (const sample of samples) {
      const initial = entries(sample);
      const unchanged = JSON.stringify(initial);
      const built = buildFrames(initial, mode);
      assert.ok(isHeap(built.at(-1).entries, mode));
      const sorted = sortFrames(initial, mode);
      assert.deepEqual(values(sorted.at(-1)), [...sample].sort((a, b) => mode === 'max' ? a - b : b - a));
      assert.equal(sorted.at(-1).sortedFrom, 0);
      assert.equal(JSON.stringify(initial), unchanged, 'source must stay unchanged');
      for (const frame of [...built, ...sorted]) {
        assert.deepEqual(frame.entries.map(entry => entry.id).sort((a, b) => a - b), initial.map(entry => entry.id));
        assert.ok(frame.active.every(index => index >= 0 && index < sample.length));
      }
      // Every frozen suffix is in final order and never changes afterwards.
      const final = values(sorted.at(-1));
      for (const frame of sorted) assert.deepEqual(values(frame).slice(frame.sortedFrom), final.slice(frame.sortedFrom));
      let comparisons = 0;
      let swaps = 0;
      for (const frame of sorted) {
        if (frame.kind === 'compare') comparisons++;
        if (frame.kind === 'swap') swaps++;
        assert.equal(frame.comparisons, comparisons);
        assert.equal(frame.swaps, swaps);
      }
    }
  });

  test(`${mode}: insertion repairs parent chains and supports insertion after sorting`, () => {
    const initial = buildFrames(entries([5, 9, 1, 3, 0, -8]), mode).at(-1).entries;
    const additions = [{ id: 6, value: 100 }, { id: 7, value: -100 }, { id: 8, value: 0 }];
    for (const source of [initial, sortFrames(initial, mode).at(-1).entries, []]) {
      const frames = insertFrames(source, additions, mode);
      const last = frames.at(-1);
      assert.ok(isHeap(last.entries, mode));
      assert.deepEqual(values(last).sort((a, b) => a - b), [...source, ...additions].map(entry => entry.value).sort((a, b) => a - b));
      assert.equal(new Set(last.entries.map(entry => entry.id)).size, last.entries.length);
      const inserts = frames.filter(frame => frame.kind === 'insert');
      assert.equal(inserts.length, additions.length);
      for (let index = 0; index < additions.length; index++) assert.deepEqual(inserts[index].entries.at(-1), additions[index]);
    }
    const validSource = buildFrames(entries([4, 8, 2]), mode).at(-1).entries;
    const frames = insertFrames(validSource, [{ id: 3, value: 20 }], mode);
    assert.equal(frames[1].kind, 'insert', 'valid heap should insert immediately');
  });

  test(`${mode}: deletion removes the selected identity and repairs any tree position`, () => {
    const samples = [[0], [5, 5, 5], [-5, 0, 3, -10, 2], [100, 50, 90, 20, 40, 80, 85, 10, 15, 35, 38, 70, 75, 82, 84], Array.from({ length: 31 }, (_, i) => (i * 17) % 31 - 15)];
    if (mode === 'min') samples.push(samples[3].map(value => -value));
    for (const sample of samples) {
      const heap = buildFrames(entries(sample), mode).at(-1).entries;
      const sort = sortFrames(heap, mode);
      const sources = [heap, sort.at(-1).entries, sort.find(frame => frame.kind === 'swap')?.entries].filter(Boolean);
      for (const source of sources) {
        for (const removed of source) {
          const before = JSON.stringify(source);
          const frames = deleteFrames(source, removed.id, mode);
          const final = frames.at(-1);
          assert.ok(isHeap(final.entries, mode));
          assert.equal(JSON.stringify(source), before);
          const byId = list => [...list].sort((a, b) => a.id - b.id);
          assert.deepEqual(byId(final.entries), byId(source.filter(entry => entry.id !== removed.id)));
          const removal = frames.findIndex(frame => frame.kind === 'remove');
          assert.ok(removal > 0);
          assert.equal(frames[removal].entries.length, source.length - 1);
          for (const frame of frames.slice(removal)) {
            assert.ok(!frame.entries.some(entry => entry.id === removed.id));
            assert.ok(frame.active.every(index => index >= 0 && index < frame.entries.length));
          }
        }
      }
    }
    assert.throws(() => deleteFrames([], 'missing', mode));
    assert.throws(() => deleteFrames(entries([10]), 99, mode));
  });
}
