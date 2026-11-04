# Anbar — architecture notes

Anbar is three small modules with no framework, no bundler and no dependencies. This document
explains the decisions behind them so the code stays easy to change.

## 1. Layering

```
app.js     UI + routing + actions        (depends on store.js and diff.js)
store.js   persistence, commits           (depends on diff.js for change counts)
diff.js    pure algorithms                (depends on nothing)
```

`diff.js` and `store.js` are environment-agnostic: they attach themselves to `window` when there
is one, and to `globalThis` otherwise, and export CommonJS when `module` exists. That is what lets
the exact same files run in the browser and in Node tests.

## 2. Data model

IndexedDB `anbar-db`, version 1.

| store | keyPath | indexes | holds |
|---|---|---|---|
| `repos` | `id` | — | name, description, accent, author, `head` (commit id), timestamps |
| `files` | `id` = `repoId::path` | `repoId` | working tree: path, content, updatedAt |
| `commits` | `id` | `repoId` | message, author, createdAt, `parent`, stats, `tree` |

A commit stores the **entire tree** (`{path: content}`), not a patch. Three consequences:

- Restoring a version is a copy operation, so it can never corrupt history.
- Diffs are computed on demand between two trees, so no patch format needs to be maintained.
- Storage grows linearly with history. That is a deliberate trade: projects here are small
  (snippets, scripts, notes), and correctness is worth more than compactness.

`HEAD` lives on the repo record, so moving it is one write in the same transaction that inserts
the commit.

### Transaction discipline

IndexedDB closes a transaction when control returns to the event loop with no pending requests.
Every read that feeds a later write is therefore done in its own readonly transaction first, and
the readwrite transaction afterwards issues all its requests synchronously. `deleteRepo` is the
clearest example of this pattern.

## 3. Diffing

`diffLines(oldText, newText)`:

1. Normalise CRLF, split into lines, drop the phantom line a trailing newline creates.
2. Build an `(n+1) × (m+1)` LCS table in a flat `Uint32Array`.
3. Backtrack from `(0,0)` into `equal / add / del` operations carrying both line numbers.
4. If `n × m > 4 000 000`, return a coarse diff (all deletions, then all additions) so the tab
   never freezes on a giant file.

`diffTrees(oldTree, newTree)` diffs every path present on either side and skips unchanged files.
`toHunks(ops, context)` keeps `context` unchanged lines around each change and drops the rest, which
is what the Changes and History panes render.

## 4. UI

One delegated `click` listener reads `data-action` from the nearest ancestor and dispatches into an
`actions` map. Adding a control means adding a button with `data-action` and one function — no
component tree, no re-render diffing.

The editor is a transparent `<textarea>` layered over a highlighted `<pre>` in the same CSS grid
cell, with a gutter synced to scroll. That keeps native text selection, caret behaviour, undo and
IME (Persian, Arabic, CJK) working for free.

Re-rendering rebuilds the panes, but the editor node is reused (re-parented) while the same file
stays open, so caret position and scroll survive tab switches.

## 5. Offline

`sw.js` pre-caches the app shell on install and serves cache-first afterwards, so a cold start
with no network is instant. The app itself never fetches anything at runtime: no fonts, no images
beyond the local icons, no analytics.

## 6. Testing

- `tests/diff.test.js` — algorithm edge cases (empty files, CRLF, pure additions, hunks, fallback).
- `tests/store.test.js` — the storage layer on `fake-indexeddb`: duplicate names, path traversal,
  empty commits, parent links, restore, export/import round-trip, cascade delete.
- `tests/ui.test.js` — jsdom boots the real `index.html` with the real scripts, clicks the demo
  project, checks the tree, the diff, the history, switches files and verifies autosave.

## 7. Known limits

- History is a snapshot per commit, so a very large project with hundreds of commits will use
  noticeable storage. A future version can store deltas with periodic full snapshots.
- No branching yet: one linear history per project.
- Content is stored as text; binary files are out of scope for now.
