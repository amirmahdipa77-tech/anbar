# Anbar · انبار

**A fast, fully offline workspace for your code — projects, files, commits and diffs, stored only on your device.**

Anbar is what a repository looks like when nobody else is watching: you open it, you write code,
you commit it, you look at the diff, you roll back. No server, no account, no sync, no telemetry.
Close the tab, lose the network, reboot — your work is still there, in your browser's own database.

یک فضای کار آفلاین برای کدهایت: پروژه، فایل، کامیت و دیف — همه فقط روی دستگاه خودت.
بدون سرور، بدون حساب، بدون همگام‌سازی و بدون ردیابی. اینترنت قطع شود هم کارت از دست نمی‌رود.

![Dashboard](screenshots/dashboard.png)

---

## Table of contents

- [Why it exists](#why-it-exists)
- [Features](#features)
- [Screens](#screens)
- [Install and run](#install-and-run)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Tests](#tests)
- [Roadmap](#roadmap)
- [فارسی](#فارسی)

## Why it exists

GitHub is a place. Anbar is a pocket. Sometimes you want the shape of a repository — files,
commits, history, diffs — for something that will never be pushed anywhere: a snippet, a
school assignment, a script you wrote on a phone, a project you want to keep private without
trusting a cloud. Anbar gives you that shape, and nothing leaves the machine.

Three rules shape the whole app:

1. **Offline is not a mode, it is the only mode.** There is not a single network request in the
   app. The service worker only exists so the files load from cache instantly.
2. **Your data is yours.** Everything lives in IndexedDB. Export it to one JSON file whenever
   you like, import it back on any device.
3. **Motion should feel alive, never slow.** Springs, not linear tweens; every transition is
   under 400 ms, and `prefers-reduced-motion` turns all of it off.

## Features

**Projects** — create, rename, describe, search and delete projects. Each one keeps its own
files, commits and history.

**File tree** — folders are real (create a file called `src/app.js` and the folder appears),
rename, delete, and a dot marks files with uncommitted edits.

**Code editor** — line numbers, syntax highlighting for JS/TS/Kotlin/Java/Python/CSS/HTML/JSON/
Markdown/Shell, autosave 700 ms after you stop typing, `Ctrl/⌘+S` to save instantly.

**Changes** — a real line diff of your working tree against the last commit: added, modified and
deleted files with `+n / −n` counts, and a unified diff with hunks of context.

**Commits** — message plus author, and a full snapshot of every file at that moment. HEAD is
marked in the history. Committing with nothing changed is refused, on purpose.

**History and restore** — every commit can show its diff against its parent, and one click puts
all files back to that version as *pending changes* — so you review and commit the rollback
instead of silently overwriting anything.

**Backup** — export every project, file and commit to a single JSON file; import it back with
one click.

**Installable app** — add Anbar to your Windows desktop or Android home screen from the browser
menu. It opens in its own window, offline, with no browser chrome.

**Crafted details** — dark and light themes, spring ("jelly") animations on every press, hover
and modal, a responsive layout that works from a 360 px phone to a wide monitor, focus states
that respect the keyboard, and toasts that never block what you are doing.

## Screens

| Code | Changes |
|---|---|
| ![Editor](screenshots/project-code.png) | ![Diff](screenshots/changes-diff.png) |

| History | Light theme |
|---|---|
| ![History](screenshots/history.png) | ![Light theme](screenshots/light.png) |

| Phone |
|---|
| ![Mobile](screenshots/mobile.png) |

## Install and run

Anbar has **no build step and no dependencies**. Pick whichever fits:

### 1. Download a release (fastest)

Every version is attached to [Releases](https://github.com/amirmahdipa77-tech/anbar/releases/latest):

| File | What it is | How to use it |
|---|---|---|
| `anbar-1.1.0.html` | the whole app in **one file** (104 KB) | double-click it. That's it — works offline, no server |
| `anbar-1.1.0.zip` | the same app as a normal folder | unzip, open `index.html` |

**Windows:** double-click the `.html` file and pin it to the taskbar, or unzip the folder and
open `index.html`. **Android:** open the `.html` file from a file manager that can hand it to a
browser, or open **https://amirmahdipa77-tech.github.io/anbar/** in Chrome and install it from
the menu.

### 2. Open the hosted version (nothing to install)

**https://amirmahdipa77-tech.github.io/anbar/** — served by GitHub Pages, and it still stores
everything locally in your own browser. On Android open it in Chrome and choose *Add to Home
screen → Install*; on Windows use the install icon in Edge or Chrome.

### 3. Run it locally and install it as an app

The install prompt and the offline service worker need `http(s)`, so serve the folder:

```bash
git clone https://github.com/amirmahdipa77-tech/anbar.git
cd anbar
python3 -m http.server 8080      # open http://localhost:8080
```

- **Windows (Edge or Chrome):** open the URL → address-bar install icon, or *Apps* →
  *Install this site as an app*. You get a real window, a Start-menu entry and a taskbar icon.
- **Android (Chrome):** open the URL → menu → *Add to Home screen* → *Install*.
- After installing, it opens with no network at all.

### 4. Build the single file yourself

```bash
python3 tools/build_single_file.py     # writes dist/anbar.html
```

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl/⌘ + S` | Save the open file |
| `Ctrl/⌘ + Enter` | Open the commit dialog |
| `Ctrl/⌘ + K` | Focus the project search |
| `Tab` (in the editor) | Insert two spaces |
| `Esc` | Close a dialog |

## Design

The look is deliberately quiet: **frosted glass panels** (`backdrop-filter: blur(22px)
saturate(180%)`) over a soft gradient, hairline borders, and iOS spacing and type
(`-apple-system`, tight tracking, 20 px radii). Lists behave like Telegram — compact rows,
rounded selection, a coloured dot per project — while buttons, segmented tabs, sheets and toasts
follow iOS conventions, including a bottom sheet on phones.

Motion is restrained on purpose: springs land in 300–400 ms, cards lift 2 px, buttons squash to
0.965, and `prefers-reduced-motion` turns everything off. The theme follows your system by
default and can be pinned to dark or light in **Settings → Appearance**. When the device asks for
reduced transparency, the glass falls back to solid panels.

## How it works

```
index.html
├── assets/js/diff.js    line diff engine (LCS) + tree diff + hunking — pure, testable
├── assets/js/store.js   IndexedDB layer: repos, files, commits, export/import
├── assets/js/app.js     UI: router, rendering, modals, editor, actions
├── assets/css/anbar.css design system, jelly springs, responsive layout
├── manifest.webmanifest + sw.js   installable, offline shell
├── tools/make_icons.py  draws the app icons with PIL (no binary assets to trust)
└── tools/build_single_file.py  bundles everything into dist/anbar.html
```

**Storage model.** Three object stores. `repos` holds project metadata and a pointer to HEAD.
`files` is the working tree — one record per path, with its content. `commits` holds an immutable
snapshot of the whole tree plus a parent pointer, so history is a linked list of complete
versions: restoring is a copy, not a replay of patches.

**Diffing.** `diff.js` builds an LCS table over lines and backtracks it into `equal / add / del`
operations with line numbers on both sides. Long unchanged runs collapse into hunks with three
lines of context. Very large files (over ~4 million cell comparisons) fall back to a coarse diff
rather than freezing the tab.

**No framework.** Rendering is plain DOM with one delegated click handler, so the whole app is
about 1 700 lines of readable JavaScript and starts instantly on a mid-range phone.

## Project layout

```
anbar/
├── index.html
├── assets/
│   ├── css/anbar.css
│   ├── js/{diff,store,app}.js
│   └── icons/{icon-192,icon-512,icon-maskable-512}.png
├── screenshots/
├── tests/{diff,store,ui}.test.js
├── tools/make_icons.py
├── manifest.webmanifest
├── sw.js
├── LICENSE
└── README.md
```

## Tests

The logic is covered by 46 checks: the diff engine, the whole storage layer (on `fake-indexeddb`)
and a jsdom smoke test that boots the real UI, creates the demo project, switches tabs, opens a
file and autosaves it.

```bash
npm install --no-save jsdom fake-indexeddb
node tests/diff.test.js
node tests/store.test.js
node tests/ui.test.js
```

## Roadmap

- Branching and merging on top of the same snapshot model
- Project-wide search and replace
- Import a folder from disk (`webkitdirectory`) and export a project as a zip
- Optional end-to-end encrypted sync between two of your own devices — off by default, forever
- A Kotlin + Compose Multiplatform build for Android and Windows, sharing the same storage and
  diff design

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it, rename it.

Built by **Amirmahdi Pop** · [github.com/amirmahdipa77-tech](https://github.com/amirmahdipa77-tech)

---

## فارسی

**انبار** یک فضای کار کامل و آفلاین برای کد است: پروژه می‌سازی، فایل اضافه می‌کنی، ادیتور با
شماره خط و رنگ‌بندی سینتکس، بعد کامیت می‌کنی و تفاوت‌ها (دیف) را خط‌به‌خط می‌بینی. هر کامیت یک
نسخه کامل از همه فایل‌ها را نگه می‌دارد، پس هر لحظه می‌توانی به هر نسخه قبلی برگردی.

**قواعد اصلی**

- هیچ درخواست شبکه‌ای در برنامه وجود ندارد. آفلاین یک حالت نیست، تنها حالت است.
- داده‌ها در IndexedDB مرورگر روی دستگاه خودت ذخیره می‌شوند؛ با یک کلیک به یک فایل JSON
  پشتیبان می‌گیری و روی هر دستگاه دیگری برمی‌گردانی.
- انیمیشن‌ها فنری و روان‌اند، همه زیر ۴۰۰ میلی‌ثانیه، و اگر سیستم‌ات «کاهش حرکت» را روشن کرده
  باشد خودکار خاموش می‌شوند.

**نصب روی ویندوز و اندروید**

- **ساده‌ترین راه:** از بخش [Releases](https://github.com/amirmahdipa77-tech/anbar/releases/latest) فایل `anbar-1.1.0.html` را دانلود کن و
  دوبار کلیک کن؛ کل برنامه در یک فایل ۱۰۴ کیلوبایتی است و بدون سرور و اینترنت کار می‌کند.
  نسخهٔ zip هم برای وقتی است که ساختار پوشه‌ای را ترجیح می‌دهی.
- **ویندوز (نصب واقعی):** در پوشهٔ مخزن `python3 -m http.server 8080` را اجرا کن، آدرس
  `http://localhost:8080` را در Edge یا Chrome باز کن و از نوار آدرس «Install» را بزن؛ پنجرهٔ
  مستقل با آیکن در استارت‌منو و تسک‌بار می‌گیری.
- **اندروید:** آدرس **https://amirmahdipa77-tech.github.io/anbar/** را در Chrome باز کن →
  منو → «Add to Home screen» → «Install»؛ داده‌ها همان‌جا روی گوشی خودت می‌مانند.
- بعد از نصب، حتی بدون اینترنت هم باز می‌شود.

**میان‌برهای کلیدی:** `Ctrl/⌘+S` ذخیره فایل، `Ctrl/⌘+Enter` پنجره کامیت، `Ctrl/⌘+K` جست‌وجوی
پروژه، `Esc` بستن پنجره.

**تست‌ها:** ۴۶ بررسی خودکار (موتور دیف، لایه ذخیره‌سازی و یک تست رابط کاربری با jsdom) که همه
سبز هستند؛ دستور اجرایشان در بخش Tests بالاست.

**لایسنس:** MIT — آزاد برای استفاده، تغییر و انتشار.

ساختهٔ **امیرمهدی پاپ**
