/*!
 * Anbar — local storage layer (IndexedDB)
 * Everything lives on the device. No network, no account, no sync.
 * MIT License — Amirmahdi Pop
 */
(function (global) {
  'use strict';

  var DB_NAME = 'anbar-db';
  var DB_VERSION = 1;
  var dbPromise = null;

  var Diff = global.AnbarDiff;

  /* ------------------------------------------------------------------ utils */

  function uid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function req(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function done(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Transaction aborted')); };
    });
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('This browser has no IndexedDB, so Anbar cannot store your projects. Try Chrome, Edge, Firefox or Safari.'));
        return;
      }
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('repos')) db.createObjectStore('repos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) {
          var files = db.createObjectStore('files', { keyPath: 'id' });
          files.createIndex('repoId', 'repoId', { unique: false });
        }
        if (!db.objectStoreNames.contains('commits')) {
          var commits = db.createObjectStore('commits', { keyPath: 'id' });
          commits.createIndex('repoId', 'repoId', { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function fileKey(repoId, path) { return repoId + '::' + path; }

  /* ------------------------------------------------------------------ repos */

  async function listRepos() {
    var db = await open();
    var all = await req(db.transaction('repos', 'readonly').objectStore('repos').getAll());
    return all.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  }

  async function getRepo(id) {
    var db = await open();
    return req(db.transaction('repos', 'readonly').objectStore('repos').get(id));
  }

  async function createRepo(input) {
    var name = (input && input.name ? String(input.name) : '').trim();
    if (!name) throw new Error('Give the project a name.');
    var repos = await listRepos();
    for (var i = 0; i < repos.length; i++) {
      if (repos[i].name.toLowerCase() === name.toLowerCase()) {
        throw new Error('A project called "' + name + '" already exists.');
      }
    }
    var now = Date.now();
    var repo = {
      id: uid(),
      name: name,
      description: (input.description || '').trim(),
      accent: input.accent || 'violet',
      author: (input.author || '').trim() || 'You',
      head: null,
      createdAt: now,
      updatedAt: now
    };
    var db = await open();
    var tx = db.transaction('repos', 'readwrite');
    tx.objectStore('repos').put(repo);
    await done(tx);
    return repo;
  }

  async function updateRepo(id, patch) {
    var repo = await getRepo(id);
    if (!repo) throw new Error('Project not found.');
    var next = Object.assign({}, repo, patch, { updatedAt: Date.now() });
    var db = await open();
    var tx = db.transaction('repos', 'readwrite');
    tx.objectStore('repos').put(next);
    await done(tx);
    return next;
  }

  async function deleteRepo(id) {
    var db = await open();

    // Read the keys first, in their own transaction: never await inside a
    // readwrite transaction, or the browser may close it underneath us.
    var readTx = db.transaction(['files', 'commits'], 'readonly');
    var fileKeys = await req(readTx.objectStore('files').index('repoId').getAllKeys(id));
    var commitKeys = await req(readTx.objectStore('commits').index('repoId').getAllKeys(id));

    var tx = db.transaction(['repos', 'files', 'commits'], 'readwrite');
    tx.objectStore('repos').delete(id);
    fileKeys.forEach(function (key) { tx.objectStore('files').delete(key); });
    commitKeys.forEach(function (key) { tx.objectStore('commits').delete(key); });
    await done(tx);
  }

  /* ------------------------------------------------------------------ files */

  async function listFiles(repoId) {
    var db = await open();
    var rows = await req(db.transaction('files', 'readonly').objectStore('files').index('repoId').getAll(repoId));
    return rows.sort(function (a, b) { return a.path.localeCompare(b.path); });
  }

  async function readFile(repoId, path) {
    var db = await open();
    return req(db.transaction('files', 'readonly').objectStore('files').get(fileKey(repoId, path)));
  }

  async function writeFile(repoId, path, content) {
    var clean = String(path || '').trim().replace(/^\/+/, '');
    if (!clean) throw new Error('A file needs a path.');
    if (/\.\./.test(clean)) throw new Error('Paths cannot contain "..".');
    var db = await open();
    var tx = db.transaction(['files', 'repos'], 'readwrite');
    var now = Date.now();
    tx.objectStore('files').put({
      id: fileKey(repoId, clean),
      repoId: repoId,
      path: clean,
      content: content === undefined || content === null ? '' : String(content),
      updatedAt: now
    });
    var repos = tx.objectStore('repos');
    repos.get(repoId).onsuccess = function (event) {
      var repo = event.target.result;
      if (repo) { repo.updatedAt = now; repos.put(repo); }
    };
    await done(tx);
  }

  async function deleteFile(repoId, path) {
    var db = await open();
    var tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(fileKey(repoId, path));
    await done(tx);
  }

  async function renameFile(repoId, from, to) {
    var row = await readFile(repoId, from);
    if (!row) throw new Error('File not found: ' + from);
    await writeFile(repoId, to, row.content);
    if (from !== to) await deleteFile(repoId, from);
  }

  async function workingTree(repoId) {
    var rows = await listFiles(repoId);
    var tree = {};
    rows.forEach(function (row) { tree[row.path] = row.content; });
    return tree;
  }

  /* ---------------------------------------------------------------- commits */

  async function listCommits(repoId) {
    var db = await open();
    var rows = await req(db.transaction('commits', 'readonly').objectStore('commits').index('repoId').getAll(repoId));
    return rows.sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  async function getCommit(id) {
    if (!id) return null;
    var db = await open();
    return req(db.transaction('commits', 'readonly').objectStore('commits').get(id));
  }

  async function headCommit(repoId) {
    var repo = await getRepo(repoId);
    if (!repo || !repo.head) return null;
    return getCommit(repo.head);
  }

  async function commit(repoId, message, author) {
    var repo = await getRepo(repoId);
    if (!repo) throw new Error('Project not found.');
    var tree = await workingTree(repoId);
    if (Object.keys(tree).length === 0) {
      throw new Error('This project has no files yet — create one before committing.');
    }
    var parent = repo.head ? await getCommit(repo.head) : null;
    var changes = Diff.diffTrees(parent ? parent.tree : {}, tree);
    if (parent && changes.length === 0) {
      throw new Error('Nothing to commit — the working tree matches the last commit.');
    }
    var record = {
      id: uid(),
      repoId: repoId,
      message: (message || '').trim() || 'Update files',
      author: (author || '').trim() || repo.author || 'You',
      createdAt: Date.now(),
      parent: parent ? parent.id : null,
      filesChanged: changes.length,
      additions: changes.reduce(function (sum, c) { return sum + c.additions; }, 0),
      deletions: changes.reduce(function (sum, c) { return sum + c.deletions; }, 0),
      tree: tree
    };
    var db = await open();
    var tx = db.transaction(['commits', 'repos'], 'readwrite');
    tx.objectStore('commits').put(record);
    var repos = tx.objectStore('repos');
    repos.get(repoId).onsuccess = function (event) {
      var fresh = event.target.result;
      if (fresh) {
        fresh.head = record.id;
        fresh.updatedAt = record.createdAt;
        if (author && String(author).trim()) fresh.author = String(author).trim();
        repos.put(fresh);
      }
    };
    await done(tx);
    return record;
  }

  /** Diff of the working tree against the head commit. */
  async function pendingChanges(repoId) {
    var head = await headCommit(repoId);
    var tree = await workingTree(repoId);
    return Diff.diffTrees(head ? head.tree : {}, tree);
  }

  /** Copy a commit's snapshot back into the working tree (does not create a commit). */
  async function restoreCommit(repoId, commitId) {
    var target = await getCommit(commitId);
    if (!target) throw new Error('Commit not found.');
    var current = await listFiles(repoId);
    var db = await open();
    var tx = db.transaction('files', 'readwrite');
    var store = tx.objectStore('files');
    current.forEach(function (row) {
      if (!Object.prototype.hasOwnProperty.call(target.tree, row.path)) store.delete(row.id);
    });
    var now = Date.now();
    Object.keys(target.tree).forEach(function (path) {
      store.put({ id: fileKey(repoId, path), repoId: repoId, path: path, content: target.tree[path], updatedAt: now });
    });
    await done(tx);
  }

  /* ------------------------------------------------------------ import/export */

  async function exportAll() {
    var repos = await listRepos();
    var payload = { app: 'anbar', version: 1, exportedAt: new Date().toISOString(), repos: [] };
    for (var i = 0; i < repos.length; i++) {
      var repo = repos[i];
      payload.repos.push({
        repo: repo,
        files: await listFiles(repo.id),
        commits: await listCommits(repo.id)
      });
    }
    return payload;
  }

  async function importAll(payload, mode) {
    if (!payload || payload.app !== 'anbar' || !Array.isArray(payload.repos)) {
      throw new Error('That file is not an Anbar backup.');
    }
    var db = await open();
    if (mode === 'replace') {
      var existing = await listRepos();
      for (var e = 0; e < existing.length; e++) await deleteRepo(existing[e].id);
    }
    var imported = 0;
    for (var i = 0; i < payload.repos.length; i++) {
      var entry = payload.repos[i] || {};
      var repo = entry.repo || {};
      var tx = db.transaction(['repos', 'files', 'commits'], 'readwrite');
      var fresh = {
        id: repo.id || uid(),
        name: repo.name || ('Project ' + (i + 1)),
        description: repo.description || '',
        accent: repo.accent || 'violet',
        author: repo.author || 'You',
        head: repo.head || null,
        createdAt: repo.createdAt || Date.now(),
        updatedAt: repo.updatedAt || Date.now()
      };
      tx.objectStore('repos').put(fresh);
      (entry.files || []).forEach(function (file) {
        tx.objectStore('files').put({
          id: fileKey(fresh.id, file.path),
          repoId: fresh.id,
          path: file.path,
          content: file.content || '',
          updatedAt: file.updatedAt || Date.now()
        });
      });
      (entry.commits || []).forEach(function (c) {
        tx.objectStore('commits').put(Object.assign({}, c, { repoId: fresh.id }));
      });
      await done(tx);
      imported++;
    }
    return imported;
  }

  async function stats(repoId) {
    var files = await listFiles(repoId);
    var commits = await listCommits(repoId);
    return { files: files.length, commits: commits.length, lastCommit: commits[0] || null };
  }

  var api = {
    uid: uid,
    open: open,
    listRepos: listRepos,
    getRepo: getRepo,
    createRepo: createRepo,
    updateRepo: updateRepo,
    deleteRepo: deleteRepo,
    listFiles: listFiles,
    readFile: readFile,
    writeFile: writeFile,
    deleteFile: deleteFile,
    renameFile: renameFile,
    workingTree: workingTree,
    listCommits: listCommits,
    getCommit: getCommit,
    headCommit: headCommit,
    commit: commit,
    pendingChanges: pendingChanges,
    restoreCommit: restoreCommit,
    exportAll: exportAll,
    importAll: importAll,
    stats: stats
  };

  global.AnbarStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
