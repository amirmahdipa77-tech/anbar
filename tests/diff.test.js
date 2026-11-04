/* Tests for the Anbar diff engine. Run: node tests/diff.test.js */
const assert = require('assert');
const path = require('path');
const Diff = require(path.join(__dirname, '..', 'assets', 'js', 'diff.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

console.log('diff engine');

test('identical text has no changes', () => {
  const ops = Diff.diffLines('a\nb\nc', 'a\nb\nc');
  assert.deepStrictEqual(ops.map((o) => o.type), ['equal', 'equal', 'equal']);
});

test('a single added line is detected', () => {
  const ops = Diff.diffLines('a\nb', 'a\nb\nc');
  const added = ops.filter((o) => o.type === 'add');
  assert.strictEqual(added.length, 1);
  assert.strictEqual(added[0].text, 'c');
  assert.strictEqual(added[0].bLine, 3);
});

test('a removed line is detected', () => {
  const ops = Diff.diffLines('a\nb\nc', 'a\nc');
  const removed = ops.filter((o) => o.type === 'del');
  assert.strictEqual(removed.length, 1);
  assert.strictEqual(removed[0].text, 'b');
});

test('a modified line shows as delete + add', () => {
  const ops = Diff.diffLines('hello world', 'hello there');
  const counts = Diff.countOps(ops);
  assert.deepStrictEqual(counts, { additions: 1, deletions: 1 });
});

test('empty to empty is empty', () => {
  assert.deepStrictEqual(Diff.diffLines('', ''), []);
});

test('CRLF input is normalised', () => {
  const ops = Diff.diffLines('a\r\nb', 'a\nb');
  assert.strictEqual(ops.every((o) => o.type === 'equal'), true);
});

test('line numbers are tracked on both sides', () => {
  const ops = Diff.diffLines('x\ny', 'x\nz\ny');
  const added = ops.find((o) => o.type === 'add');
  assert.strictEqual(added.bLine, 2);
  const last = ops[ops.length - 1];
  assert.strictEqual(last.aLine, 2);
  assert.strictEqual(last.bLine, 3);
});

test('tree diff finds added, modified and deleted files', () => {
  const before = { 'a.js': 'one', 'b.js': 'two', 'gone.js': 'bye' };
  const after = { 'a.js': 'one', 'b.js': 'two changed', 'new.js': 'hi' };
  const changes = Diff.diffTrees(before, after);
  const byPath = {};
  changes.forEach((c) => { byPath[c.path] = c; });
  assert.strictEqual(byPath['a.js'], undefined, 'unchanged file is skipped');
  assert.strictEqual(byPath['b.js'].status, 'modified');
  assert.strictEqual(byPath['gone.js'].status, 'deleted');
  assert.strictEqual(byPath['new.js'].status, 'added');
  assert.strictEqual(byPath['new.js'].additions, 1);
});

test('tree diff against an empty tree marks everything added', () => {
  const changes = Diff.diffTrees({}, { 'a.txt': 'x', 'b/c.txt': 'y' });
  assert.strictEqual(changes.length, 2);
  assert.ok(changes.every((c) => c.status === 'added'));
});

test('hunks keep context and drop long unchanged runs', () => {
  const before = Array.from({ length: 40 }, (_, i) => 'line ' + i).join('\n');
  const after = before.replace('line 20', 'line twenty');
  const ops = Diff.diffLines(before, after);
  const hunks = Diff.toHunks(ops, 2);
  assert.strictEqual(hunks.length, 1);
  assert.ok(hunks[0].length <= 6, 'context is trimmed to 2 lines either side, got ' + hunks[0].length);
});

test('large inputs fall back without throwing', () => {
  const big = Array.from({ length: 2500 }, (_, i) => 'row ' + i).join('\n');
  const other = big + '\nextra';
  const ops = Diff.diffLines(big, other);
  assert.ok(ops.length > 0);
});

console.log('\n' + passed + ' diff tests passed');
