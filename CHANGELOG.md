# Changelog

## 2.2.2 — the size fix that actually lands

- `reactNativeArchitectures` now pins the build to `arm64-v8a`. That single line is where the
  megabytes were: the previous APK still carried four sets of native libraries.
- R8 full mode, minification, resource shrinking and PNG crunching are asserted, not assumed.
- The trim script now edits `gradle.properties` (the file the React Native template actually reads)
  instead of guessing at a `defaultConfig` block.

## 2.2.1 — build fix

- The trim script no longer insists on Gradle flags the Expo template stopped emitting; the
  expo-build-properties plugin sets them, and the script now only requires the ABI filter, which it
  verifies before failing.
- Dropped the `edgeToEdgeEnabled` key that Android 16 made obsolete.
- First release that actually ships the trimmed APK.

## 2.2.0 — liquid glass, a publish tab, and a much smaller APK

**Size**
- R8 minification, resource shrinking and PNG crunching are on for release builds.
- The APK now ships only the 64-bit ARM libraries instead of every architecture.
- `tools/trim_android.py` applies both at build time and fails loudly if a pattern moves.

**Publish (new tab, replaces Search)**
- Turns any project into a real git repository: a `git fast-import` stream with every commit,
  message, author and timestamp, plus the three commands that import it and push it.
- One tap copies the commands, another copies the stream. Nothing is uploaded by the app — the
  push happens in your own terminal, which is the only way to keep the no-network promise.

**Design**
- The bar is now liquid glass: blur plus a soft specular sheen, rounder highlight, spring-driven
  slide instead of a timed tween.
- Cards carry a faint top-light sheen; the Publish header card tints with the accent.
- Settings uses the real gear icon.
- Search inside a project stays in the workspace header; the global search screen is gone.

## 2.1.0 — floating navigation and the precise editor

**Navigation**
- A floating glass bar (blurred, translucent, safe-area aware) replaces the header-only navigation.
- The active tab is a single highlight view that slides between positions — one animation per
  switch, no layout work.
- Four places: Projects, Activity, Search, Settings. The bar steps aside inside a project so files,
  diffs and commits get the full screen.

**Editor**
- Line-number gutter that scrolls in sync with the text, with the current line highlighted.
- Two modes: **Write** (fast input, autosave, undo/redo) and **Ruled** (one row per line, so the
  gutter, the column ruler and horizontal scroll can never drift; tap a line to edit it).
- Column ruler at 72 / 80 / 100 characters, drawn as a hairline in both modes.
- Find in file with match counter, next/previous, replace one and replace all.
- File tools sheet: ruler, font size, duplicate line, move line up/down, go to line, rename or move
  the file, delete.
- Live `line X, col Y` in the header, plus line, character and ruler readout in the footer.

**New screens**
- Activity: every commit across every project, grouped by day, one tap from the diff.
- Search: inside every file of every project, grouped by file.

**Fixes**
- The dashboard no longer stacks a floating action under the new bar; “New project” moved to the
  header.
- Removed the noisy commit-count badge from the bar.

## 2.0.0 — the native app

Anbar is now a React Native application instead of a web page. The rewrite was driven by three
complaints about 1.x: it needed a browser, it had no real security posture, and it was thin on
features.

**New platform**
- React Native (Expo SDK 58, React 19, RN 0.88), TypeScript strict, no navigation or state library.
- Android APK built in CI on every tag; the same code exports to a static web build.
- The Android manifest blocks `INTERNET`, `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` — the app
  cannot reach the network even in principle.

**New features**
- App lock: 4–6 digit PIN stored only as a salted SHA-256 hash, biometric unlock, configurable
  auto-lock, immediate lock on backgrounding.
- Find in files: search every file of a project, grouped by file.
- Commit detail: per-commit diff against its parent, read-only browser of the snapshot's files,
  and restore-as-pending-changes.
- Author identity, per-project descriptions, search over projects, rename and delete flows.
- Backup export/import through the clipboard.
- Appearance: system, light or dark.

**New design**
- Flat surfaces, hairline dividers, one accent colour per theme, no gradients or glow.
- Type-led hierarchy on the system font; monospace for ids, counts and diffs.
- Short eased motion (140–280 ms); the only playful moment is the lock screen shake.

**Removed**
- The single-file HTML app, the service worker and the old web screenshots. The 1.x builds remain
  available in the v1.1.0 release.

## 1.1.0 — glass redesign

- Frosted-glass surfaces, iOS-flavoured controls, Telegram-style lists, system appearance setting.
- Single-file HTML build (`anbar-1.1.0.html`) and a folder build (`anbar-1.1.0.zip`).

## 1.0.0 — first version

- Projects, file tree, editor with autosave, line diff, commits with snapshots, history with
  restore, JSON backup, 46 automated checks.
