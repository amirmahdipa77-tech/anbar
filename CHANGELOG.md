# Changelog

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
