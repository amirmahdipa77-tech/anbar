/* Tests for the Anbar storage layer, on top of fake-indexeddb.
   Run: NODE_PATH=<node_modules> node tests/store.test.js */
require('fake-indexeddb/auto');
require('../assets/js/diff.js');
const Store = require('../assets/js/store.js');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('creates a project and lists it', async () => {
  const repo = await Store.createRepo({ name: 'alpha', description: 'first' });
  if (!repo.id) throw new Error('no id');
  const repos = await Store.listRepos();
  if (!repos.some((r) => r.id === repo.id)) throw new Error('project missing from list');
});

test('refuses a duplicate project name', async () => {
  await Store.createRepo({ name: 'beta' });
  let failed = false;
  try { await Store.createRepo({ name: 'BETA' }); } catch (err) { failed = /already exists/.test(err.message); }
  if (!failed) throw new Error('duplicate name was accepted');
});

test('refuses an empty project name', async () => {
  let failed = false;
  try { await Store.createRepo({ name: '   ' }); } catch (err) { failed = true; }
  if (!failed) throw new Error('empty name was accepted');
});

test('writes, reads and lists files', async () => {
  const repo = await Store.createRepo({ name: 'files' });
  await Store.writeFile(repo.id, 'src/app.js', 'const a = 1;\n');
  await Store.writeFile(repo.id, 'README.md', '# hi\n');
  const files = await Store.listFiles(repo.id);
  if (files.length !== 2) throw new Error('expected 2 files, got ' + files.length);
  const row = await Store.readFile(repo.id, 'src/app.js');
  if (row.content !== 'const a = 1;\n') throw new Error('content mismatch');
});

test('rejects path traversal', async () => {
  const repo = await Store.createRepo({ name: 'paths' });
  let failed = false;
  try { await Store.writeFile(repo.id, '../escape.txt', 'x'); } catch (err) { failed = true; }
  if (!failed) throw new Error('traversal path was accepted');
});

test('commits a snapshot and moves HEAD', async () => {
  const repo = await Store.createRepo({ name: 'commit-one' });
  await Store.writeFile(repo.id, 'a.txt', 'one\ntwo\n');
  const commit = await Store.commit(repo.id, 'first commit', 'Tester');
  const fresh = await Store.getRepo(repo.id);
  if (fresh.head !== commit.id) throw new Error('HEAD did not move');
  if (commit.filesChanged !== 1) throw new Error('expected 1 changed file, got ' + commit.filesChanged);
  if (commit.additions !== 2) throw new Error('expected 2 additions, got ' + commit.additions);
  if (commit.author !== 'Tester') throw new Error('author not stored');
});

test('refuses to commit an empty project', async () => {
  const repo = await Store.createRepo({ name: 'empty-repo' });
  let failed = false;
  try { await Store.commit(repo.id, 'nothing'); } catch (err) { failed = /no files/.test(err.message); }
  if (!failed) throw new Error('empty commit was accepted');
});

test('refuses to commit when nothing changed', async () => {
  const repo = await Store.createRepo({ name: 'no-change' });
  await Store.writeFile(repo.id, 'a.txt', 'hello\n');
  await Store.commit(repo.id, 'first');
  let failed = false;
  try { await Store.commit(repo.id, 'second'); } catch (err) { failed = /Nothing to commit/.test(err.message); }
  if (!failed) throw new Error('empty second commit was accepted');
});

test('pendingChanges reports edits against HEAD', async () => {
  const repo = await Store.createRepo({ name: 'pending' });
  await Store.writeFile(repo.id, 'a.txt', 'one\n');
  await Store.commit(repo.id, 'base');
  let pending = await Store.pendingChanges(repo.id);
  if (pending.length !== 0) throw new Error('expected a clean tree');

  await Store.writeFile(repo.id, 'a.txt', 'one\ntwo\n');
  await Store.writeFile(repo.id, 'b.txt', 'new file\n');
  pending = await Store.pendingChanges(repo.id);
  const statuses = pending.map((p) => p.path + ':' + p.status).sort();
  if (statuses.join(',') !== 'a.txt:modified,b.txt:added') throw new Error('unexpected changes: ' + statuses.join(','));
});

test('second commit links to its parent', async () => {
  const repo = await Store.createRepo({ name: 'chain' });
  await Store.writeFile(repo.id, 'a.txt', 'v1\n');
  const first = await Store.commit(repo.id, 'v1');
  await Store.writeFile(repo.id, 'a.txt', 'v2\n');
  const second = await Store.commit(repo.id, 'v2');
  if (second.parent !== first.id) throw new Error('parent link missing');
  const history = await Store.listCommits(repo.id);
  if (history.length !== 2) throw new Error('expected 2 commits');
  if (history[0].id !== second.id) throw new Error('history is not newest-first');
});

test('restores a previous snapshot into the working tree', async () => {
  const repo = await Store.createRepo({ name: 'restore' });
  await Store.writeFile(repo.id, 'a.txt', 'original\n');
  const first = await Store.commit(repo.id, 'original');
  await Store.writeFile(repo.id, 'a.txt', 'changed\n');
  await Store.writeFile(repo.id, 'extra.txt', 'added later\n');
  await Store.commit(repo.id, 'changed');

  await Store.restoreCommit(repo.id, first.id);
  const tree = await Store.workingTree(repo.id);
  if (tree['a.txt'] !== 'original\n') throw new Error('file was not restored');
  if (Object.prototype.hasOwnProperty.call(tree, 'extra.txt')) throw new Error('file added after the commit should be gone');
});

test('renames and deletes files', async () => {
  const repo = await Store.createRepo({ name: 'rename' });
  await Store.writeFile(repo.id, 'old.txt', 'body\n');
  await Store.renameFile(repo.id, 'old.txt', 'new.txt');
  let files = await Store.listFiles(repo.id);
  if (files.length !== 1 || files[0].path !== 'new.txt') throw new Error('rename failed');
  await Store.deleteFile(repo.id, 'new.txt');
  files = await Store.listFiles(repo.id);
  if (files.length !== 0) throw new Error('delete failed');
});

test('export and import round-trip', async () => {
  const repo = await Store.createRepo({ name: 'portable' });
  await Store.writeFile(repo.id, 'a.txt', 'payload\n');
  await Store.commit(repo.id, 'portable commit');
  const dump = await Store.exportAll();
  if (dump.app !== 'anbar' || !dump.repos.length) throw new Error('bad export shape');

  await Store.deleteRepo(repo.id);
  const count = await Store.importAll(dump, 'merge');
  if (count < 1) throw new Error('nothing imported');
  const repos = await Store.listRepos();
  const back = repos.find((r) => r.name === 'portable');
  if (!back) throw new Error('project did not come back');
  const tree = await Store.workingTree(back.id);
  if (tree['a.txt'] !== 'payload\n') throw new Error('file content lost in the round-trip');
});

test('deleting a project removes its files and commits', async () => {
  const repo = await Store.createRepo({ name: 'doomed' });
  await Store.writeFile(repo.id, 'a.txt', 'x\n');
  await Store.commit(repo.id, 'only commit');
  await Store.deleteRepo(repo.id);
  const files = await Store.listFiles(repo.id);
  const commits = await Store.listCommits(repo.id);
  const repoAfter = await Store.getRepo(repo.id);
  if (files.length || commits.length || repoAfter) throw new Error('leftovers after delete');
});

test('stats summarises a project', async () => {
  const repo = await Store.createRepo({ name: 'stats' });
  await Store.writeFile(repo.id, 'a.txt', 'x\n');
  await Store.writeFile(repo.id, 'b.txt', 'y\n');
  await Store.commit(repo.id, 'two files');
  const s = await Store.stats(repo.id);
  if (s.files !== 2 || s.commits !== 1 || !s.lastCommit) throw new Error('bad stats ' + JSON.stringify(s));
});

(async () => {
  console.log('storage layer');
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
      console.log('  ✓', name);
    } catch (err) {
      console.error('  ✗', name);
      console.error('   ', err.message);
      process.exitCode = 1;
    }
  }
  console.log('\n' + passed + '/' + tests.length + ' storage tests passed');
})();
