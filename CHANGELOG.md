# Changelog

## 1.1.0 — glass redesign and installable builds

**Design**
- Soft frosted-glass surfaces (`backdrop-filter`) over a gradient canvas, hairline borders and
  deeper, softer shadows.
- iOS-flavoured typography, spacing and controls: segmented tabs, 12 px radii, sheet-style modals
  on phones, glass toasts.
- Telegram-style sidebar and lists: compact rows, rounded selection, a coloured dot per project.
- Motion toned down: springs land in 300–400 ms, smaller travel, no bounce on hover.
- Appearance setting: **Match the system**, **Dark**, **Light**. The system default is detected
  automatically and follows live changes.
- Reduced-transparency and reduced-motion fallbacks.

**Packaging**
- `tools/build_single_file.py` bundles the whole app into one 104 KB HTML file with icons
  inlined as data URIs — no server needed, works by double-clicking.
- Releases now ship two assets: `anbar-1.1.0.html` (single file) and `anbar-1.1.0.zip` (folder).
- Branch chip and tree icons use inline SVG instead of emoji, so nothing depends on a system
  emoji font.

**Fixes**
- Correct plural wording ("1 commit", "1 pending change").
- Diff line counts no longer treat a trailing newline as an extra line.
- Mobile header no longer stretches when the project list is short.

## 1.0.0 — first version

- Projects, file tree, editor with syntax highlighting and autosave.
- Line diff, commits with full snapshots, history with per-commit diffs and one-click restore.
- JSON export/import, dark theme, installable PWA, 46 automated checks.
