# Anbar — architecture

Anbar is a React Native app with no state library, no navigation library and no ORM. This document
records the decisions that keep it small, and the constraints that keep it safe.

## 1. Layers

```
App.tsx            state, routing, lock gate, lifecycle
screens/*          one screen per route, props in, callbacks out
ui/kit.tsx         theme provider + primitives (text, button, row, sheet, toast, segmented)
storage/db.ts      persistence and commits
security/pin.ts    PIN hashing, biometrics, settings
core/*             pure functions: diff, formatting, ids
```

`core/` and `storage/` never import React, so they run unchanged in Node for tests. `screens/` never
import `storage/` directly: they receive data and callbacks from `App.tsx`, which keeps every
mutation in one place and makes screens trivial to reason about.

## 2. Routing

There is no navigator dependency. `App.tsx` holds a discriminated union:

```ts
type Route =
  | { name: 'dashboard' }
  | { name: 'workspace'; projectId: string }
  | { name: 'editor'; projectId: string; path: string }
  | { name: 'diff'; projectId: string; title: string; changes: Change[] }
  | { name: 'commit'; projectId: string; commit: Commit }
  | { name: 'viewer'; title: string; content: string }
  | { name: 'find'; projectId: string }
  | { name: 'settings' };
```

`back()` is a switch over that union, so every screen has exactly one defined way back. Deep linking
would be a matter of mapping a URL onto the same union.

## 3. Storage

AsyncStorage, two shapes:

| key | value |
|---|---|
| `anbar:v2:index` | `Project[]` — id, name, description, author, timestamps, `head` |
| `anbar:v2:project:<id>` | `{ files: Record<path, string>, commits: Commit[] }` |
| `anbar:v2:settings` | theme, author, lock config (salt + hash), auto-lock delay |

A commit stores the **entire tree**. Three consequences, all deliberate:

- Restoring a version is a copy, so history can never be corrupted by replaying a bad patch.
- Diffs are computed between two trees on demand, so no patch format has to be maintained.
- Storage grows linearly with history. Projects here are snippets and scripts; correctness is worth
  more than compactness.

Every write goes through `serialise()`, a promise queue. AsyncStorage has no transactions, so
without it two taps (say, save-file and commit) could interleave a read-modify-write and lose the
other's change.

## 4. Diffing

`diffLines(oldText, newText)`:

1. Normalise CRLF, split into lines, drop the phantom line a trailing newline creates.
2. Build an `(n+1) × (m+1)` LCS table in a flat `Uint32Array`.
3. Backtrack into `equal / add / del` operations that carry both line numbers.
4. If `n × m > 4 000 000`, return a coarse diff (all deletions then all additions) so the UI never
   freezes on a giant file.

`toHunks(ops, 3)` keeps three unchanged lines around each change and drops the rest — that is what
the diff screen renders.

## 5. Security model

- **No network.** `app.json` blocks `INTERNET`, `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` for the
  Android build. There is no HTTP client in the dependency tree.
- **PIN.** 4–6 digits. We store `salt` (16 random bytes, hex) and `SHA-256(salt:pin)`; the PIN itself
  is never written anywhere. Verification re-hashes the input and compares.
- **Biometrics.** Delegated to `expo-local-authentication`; the app only learns success or failure.
- **Auto-lock.** An `AppState` listener records when the app went to the background and locks on
  return once the configured delay has passed.
- **Data at rest** is protected by the OS sandbox (and by Android's file-based encryption when the
  device is locked). Anbar does not add a second layer of encryption over AsyncStorage; that would
  need a native key store and is on the roadmap, not in the current build.

## 6. Design system

`src/theme.ts` holds one neutral ramp plus a single accent per theme, a 4 px spacing scale, three
radii and a three-step motion scale. `ui/kit.tsx` exposes primitives that consume those tokens, so a
screen never hardcodes a colour.

Rules the code follows:

- Surfaces are flat; separation is a 1 px hairline plus space.
- Shadow exists only under the bottom sheet, where it carries meaning.
- Motion is `Easing.out(Easing.cubic)` between 140 and 280 ms. Nothing springs.
- Numbers that a user might compare (commit ids, line counts, `+n/−n`) are monospace.

## 7. Testing

`npm test` compiles the pure modules to CommonJS (`tsconfig.test.json`) and runs `tests/run.js` with
Node's own assertions. AsyncStorage is replaced by an in-memory map through a `Module._load` hook, so
the real `db.ts` runs unchanged — the tests exercise our code, not a mock of it.

## 8. Known limits

- One linear history per project; no branches yet.
- Text files only — binary files are out of scope.
- The APK is signed with the Android debug key; a Play Store release needs your own keystore.
- Very large histories grow storage linearly (see §3).
