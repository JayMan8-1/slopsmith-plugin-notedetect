// Coverage for _diagLookupConstituentJudgments — the constituent-judgment
// resolver behind power-chord miss-cause classification (root-heard/fifth-weak
// etc.). It must handle Map / Array / plain-object noteResults, match on s+f,
// pick the nearest in-tolerance judgment, and fall back chartNote->note.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadDetectionCore } = require('./_loader');

const core = loadDetectionCore();
const lookup = core.diagLookupConstituentJudgments;

const VOICING = [
    { s: 0, f: 0, role: 'root' },
    { s: 1, f: 2, role: 'fifth' },
];

function j(s, f, noteTime, hit, useNote) {
    const cn = { s, f };
    return useNote ? { note: cn, noteTime, hit } : { chartNote: cn, noteTime, hit };
}

test('exposed from the shipping screen.js', () => {
    assert.equal(typeof lookup, 'function');
});

test('Array input: matches each voicing string by s+f and reports hit/miss', () => {
    const entries = [j(0, 0, 4.00, true), j(1, 2, 4.00, false)];
    const out = lookup(entries, 4.0, VOICING, 0.075);
    assert.equal(out.length, 2);
    const root = out.find((r) => r.role === 'root');
    const fifth = out.find((r) => r.role === 'fifth');
    assert.equal(root.hit, true);
    assert.equal(fifth.hit, false);
    assert.ok(fifth.judgment, 'fifth judgment resolved');
});

test('Map input (.values()) resolves the same as Array — the Map branch is live', () => {
    const m = new Map([
        ['a', j(0, 0, 4.0, true)],
        ['b', j(1, 2, 4.0, true)],
    ]);
    const out = lookup(m, 4.0, VOICING, 0.075);
    assert.deepEqual(out.map((r) => r.hit), [true, true]);
});

test('plain-object input (Object.values()) resolves judgments', () => {
    const obj = { x: j(0, 0, 4.0, true), y: j(1, 2, 4.0, false) };
    const out = lookup(obj, 4.0, VOICING, 0.075);
    assert.equal(out.find((r) => r.role === 'root').hit, true);
    assert.equal(out.find((r) => r.role === 'fifth').hit, false);
});

test('wrong s/f does not match — judgment null, hit false', () => {
    // Only a string-3 fret-5 judgment present; neither voicing string matches.
    const out = lookup([j(3, 5, 4.0, true)], 4.0, VOICING, 0.075);
    assert.equal(out.every((r) => r.judgment === null && r.hit === false), true);
});

test('outside tolerance is rejected', () => {
    const out = lookup([j(0, 0, 4.20, true)], 4.0, VOICING, 0.075); // 200ms > 75ms
    assert.equal(out.find((r) => r.role === 'root').judgment, null);
});

test('nearest noteTime wins when multiple match within tolerance', () => {
    // Two root candidates within tol; the closer one (a miss at 4.01) should win
    // over the farther one (a hit at 4.06), proving the dt tie-break, not order.
    const entries = [j(0, 0, 4.06, true), j(0, 0, 4.01, false)];
    const out = lookup(entries, 4.0, VOICING, 0.075);
    assert.equal(out.find((r) => r.role === 'root').hit, false);
});

test('chartNote || note fallback: entries keyed under `note` still match', () => {
    const out = lookup([j(0, 0, 4.0, true, /*useNote*/ true)], 4.0, VOICING, 0.075);
    assert.equal(out.find((r) => r.role === 'root').hit, true);
});

test('guards: empty voicing and non-finite t return []', () => {
    // .length (not deepEqual) — the helper runs in the vm sandbox realm, so its
    // array prototype differs from this test realm's and deepStrictEqual rejects it.
    assert.equal(lookup([j(0, 0, 4.0, true)], 4.0, [], 0.075).length, 0);
    assert.equal(lookup([j(0, 0, 4.0, true)], NaN, VOICING, 0.075).length, 0);
});
