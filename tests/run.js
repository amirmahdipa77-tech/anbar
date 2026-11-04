/**
 * Test runner for the logic that does not need a device:
 * the diff engine and the storage layer.
 *
 *   npm test    (compiles with tsc, then runs this file)
 *
 * AsyncStorage is replaced with an in-memory map, so the real storage code runs
 * unchanged — no mocking of our own functions.
 */
const Module = require('module');
const assert = require('assert');
const path = require('path');

const store = new Map();
const fakeAsyncStorage = {
  async getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async setItem(key, value) {
    store.set(key, value);
  },
  async removeItem(key) {
    store.delete(key);
  },
  async clear() {
    store.clear();
  },
  async getAllKeys() {
    return Array.from(store.keys());
  },
};

const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return fakeAsyncStorage;
  return originalLoad.call(this, request, parent, isMain);
};

const build = path.join(__dirname, '..', '.test-build', 'src');
const diff = require(path.join(build, 'core', 'diff.js'));
const db = require(path.join(build, 'storage', 'db.js'));

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log('  ✗', name, '—', error.message);
  }
}

(async () => {
  console.log('diff engine');

  await test('identical text has no changes', () => {
    const ops = diff.diffLines('a\nb', 'a\nb');
    assert.deepStrictEqual(ops.map((op) => op.type), ['equal', 'equal']);
  });

  await test('detects an added line with its line number', () => {
    const ops = diff.diffLines('a\nb', 'a\nb\nc');
    const added = ops.filter((op) => op.type === 'add');
    assert.strictEqual(added.length, 1);
    assert.strictEqual(added[0].bLine, 3);
  });

  await test('detects a removed line', () => {
    const ops = diff.diffLines('a\nb\nc', 'a\nc');
    assert.strictEqual(ops.filter((op) => op.type === 'del').length, 1);
  });

  await test('a changed line becomes delete + add', () => {
    const counts = diff.countOps(diff.diffLines('one', 'two'));
    assert.deepStrictEqual(counts, { additions: 1, deletions: 1 });
  });

  await test('empty files produce no ops', () => {
    assert.deepStrictEqual(diff.diffLines('', ''), []);
  });

  await test('a trailing newline is not an extra line', () => {
    assert.deepStrictEqual(diff.splitLines('a\nb\n'), ['a', 'b']);
    assert.deepStrictEqual(diff.splitLines('a\nb'), ['a', 'b']);
  });

  await test('CRLF is normalised', () => {
    const ops = diff.diffLines('a\r\nb', 'a\nb');
    assert.ok(ops.every((op) => op.type === 'equal'));
  });

  await test('tree diff reports added, modified and deleted', () => {
    const changes = diff.diffTrees(
      { 'a.ts': 'one', 'b.ts': 'two', 'gone.ts': 'bye' },
      { 'a.ts': 'one', 'b.ts': 'two!', 'new.ts': 'hi' },
    );
    const byPath = Object.fromEntries(changes.map((change) => [change.path, change.status]));
    assert.deepStrictEqual(byPath, { 'b.ts': 'modified', 'gone.ts': 'deleted', 'new.ts': 'added' });
  });

  await test('hunks keep context and drop long unchanged runs', () => {
    const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 20', 'line twenty');
    const hunks = diff.toHunks(diff.diffLines(before, after), 2);
    assert.strictEqual(hunks.length, 1);
    assert.ok(hunks[0].length <= 6);
  });

  await test('very large inputs fall back instead of freezing', () => {
    const big = Array.from({ length: 2600 }, (_, i) => `row ${i}`).join('\n');
    assert.ok(diff.diffLines(big, `${big}\nextra`).length > 0);
  });

  console.log('\nstorage layer');

  await test('creates a project and lists it', async () => {
    const project = await db.createProject({ name: 'alpha' });
    const list = await db.listProjects();
    assert.ok(list.some((item) => item.id === project.id));
  });

  await test('refuses duplicate and empty names', async () => {
    await db.createProject({ name: 'beta' });
    await assert.rejects(() => db.createProject({ name: 'BETA' }), /already exists/);
    await assert.rejects(() => db.createProject({ name: '   ' }), /name/);
  });

  await test('writes, reads and rejects traversal paths', async () => {
    const project = await db.createProject({ name: 'files' });
    await db.writeFile(project.id, 'src/app.ts', 'const a = 1;\n');
    const data = await db.getProjectData(project.id);
    assert.strictEqual(data.files['src/app.ts'], 'const a = 1;\n');
    await assert.rejects(() => db.writeFile(project.id, '../escape.txt', 'x'), /\.\./);
  });

  await test('commits a snapshot and moves HEAD', async () => {
    const project = await db.createProject({ name: 'commit-one' });
    await db.writeFile(project.id, 'a.txt', 'one\ntwo\n');
    const commit = await db.commit(project.id, 'first', 'Tester');
    const fresh = await db.getProject(project.id);
    assert.strictEqual(fresh.head, commit.id);
    assert.strictEqual(commit.filesChanged, 1);
    assert.strictEqual(commit.additions, 2);
    assert.strictEqual(commit.author, 'Tester');
  });

  await test('refuses an empty project commit', async () => {
    const project = await db.createProject({ name: 'empty-repo' });
    await assert.rejects(() => db.commit(project.id, 'nothing'), /no files/);
  });

  await test('refuses a commit with no changes', async () => {
    const project = await db.createProject({ name: 'no-change' });
    await db.writeFile(project.id, 'a.txt', 'hello\n');
    await db.commit(project.id, 'first');
    await assert.rejects(() => db.commit(project.id, 'second'), /Nothing to commit/);
  });

  await test('workingChanges reports edits against HEAD', async () => {
    const project = await db.createProject({ name: 'pending' });
    await db.writeFile(project.id, 'a.txt', 'one\n');
    await db.commit(project.id, 'base');
    assert.strictEqual((await db.workingChanges(project.id)).length, 0);
    await db.writeFile(project.id, 'a.txt', 'one\ntwo\n');
    await db.writeFile(project.id, 'b.txt', 'new\n');
    const statuses = (await db.workingChanges(project.id)).map((change) => `${change.path}:${change.status}`).sort();
    assert.deepStrictEqual(statuses, ['a.txt:modified', 'b.txt:added']);
  });

  await test('second commit links to its parent, newest first', async () => {
    const project = await db.createProject({ name: 'chain' });
    await db.writeFile(project.id, 'a.txt', 'v1\n');
    const first = await db.commit(project.id, 'v1');
    await db.writeFile(project.id, 'a.txt', 'v2\n');
    const second = await db.commit(project.id, 'v2');
    assert.strictEqual(second.parent, first.id);
    const data = await db.getProjectData(project.id);
    assert.strictEqual(data.commits[0].id, second.id);
    assert.strictEqual(data.commits.length, 2);
  });

  await test('restore brings back an older snapshot', async () => {
    const project = await db.createProject({ name: 'restore' });
    await db.writeFile(project.id, 'a.txt', 'original\n');
    const first = await db.commit(project.id, 'original');
    await db.writeFile(project.id, 'a.txt', 'changed\n');
    await db.writeFile(project.id, 'extra.txt', 'later\n');
    await db.commit(project.id, 'changed');
    await db.restoreCommit(project.id, first.id);
    const data = await db.getProjectData(project.id);
    assert.strictEqual(data.files['a.txt'], 'original\n');
    assert.ok(!('extra.txt' in data.files));
  });

  await test('rename and delete files', async () => {
    const project = await db.createProject({ name: 'rename' });
    await db.writeFile(project.id, 'old.txt', 'body\n');
    await db.renameFile(project.id, 'old.txt', 'new.txt');
    let data = await db.getProjectData(project.id);
    assert.deepStrictEqual(Object.keys(data.files), ['new.txt']);
    await db.deleteFile(project.id, 'new.txt');
    data = await db.getProjectData(project.id);
    assert.deepStrictEqual(Object.keys(data.files), []);
  });

  await test('export and import round-trip', async () => {
    const project = await db.createProject({ name: 'portable' });
    await db.writeFile(project.id, 'a.txt', 'payload\n');
    await db.commit(project.id, 'portable');
    const backup = await db.exportBackup();
    await db.deleteProject(project.id);
    const count = await db.importBackup(backup);
    assert.ok(count >= 1);
    const restored = (await db.listProjects()).find((item) => item.name === 'portable');
    assert.ok(restored);
    const data = await db.getProjectData(restored.id);
    assert.strictEqual(data.files['a.txt'], 'payload\n');
  });

  await test('import rejects a foreign file', async () => {
    await assert.rejects(() => db.importBackup('{"app":"other"}'), /not an Anbar backup/);
    await assert.rejects(() => db.importBackup('not json'), /valid JSON/);
  });

  await test('deleting a project removes its data', async () => {
    const project = await db.createProject({ name: 'doomed' });
    await db.writeFile(project.id, 'a.txt', 'x\n');
    await db.commit(project.id, 'only');
    await db.deleteProject(project.id);
    assert.strictEqual(await db.getProject(project.id), null);
    const data = await db.getProjectData(project.id);
    assert.deepStrictEqual(data, { files: {}, commits: [] });
  });

  await test('demo seeding is idempotent', async () => {
    const first = await db.seedDemo('Tester');
    const second = await db.seedDemo('Tester');
    assert.strictEqual(first.id, second.id);
    const data = await db.getProjectData(first.id);
    assert.strictEqual(data.commits.length, 1);
    assert.ok(Object.keys(data.files).length >= 4);
  });

  await test('commitDiff compares a commit with its parent', async () => {
    const project = await db.createProject({ name: 'diffable' });
    await db.writeFile(project.id, 'a.txt', 'one\n');
    const first = await db.commit(project.id, 'first');
    await db.writeFile(project.id, 'a.txt', 'one\ntwo\n');
    const second = await db.commit(project.id, 'second');
    const changes = await db.commitDiff(project.id, second.id);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].additions, 1);
    const firstChanges = await db.commitDiff(project.id, first.id);
    assert.strictEqual(firstChanges[0].status, 'added');
  });

  console.log(`\n${passed} checks passed${failures.length ? `, ${failures.length} failed` : ''}`);
  if (failures.length) {
    failures.forEach((failure) => console.log('  FAILED:', failure));
    process.exitCode = 1;
  }
})();
