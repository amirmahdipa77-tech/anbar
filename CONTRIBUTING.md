# Contributing to Anbar

Thanks for wanting to help. Anbar is small on purpose — a whole feature should fit in your head.

## Ground rules

1. **No network calls.** Not for fonts, not for analytics, not for anything. If a feature needs
   the internet to work, it does not belong here.
2. **No build step and no dependencies in the app.** `index.html` must keep working by
   double-clicking it. Dev-only tools (jsdom, fake-indexeddb) are fine under `tests/`.
3. **No framework.** Plain DOM, one delegated click handler, small modules.
4. **Motion stays under 400 ms** and must respect `prefers-reduced-motion`.
5. **Data safety first.** Never silently destroy user data. Anything destructive asks first.

## Workflow

```bash
git clone https://github.com/amirmahdipa77-tech/anbar.git
cd anbar
python3 -m http.server 8080      # open http://localhost:8080
npm install --no-save jsdom fake-indexeddb
node tests/diff.test.js && node tests/store.test.js && node tests/ui.test.js
```

Add a test with every change:

- pure logic → `tests/diff.test.js`
- storage behaviour → `tests/store.test.js`
- anything a user clicks → `tests/ui.test.js`

## Ideas that would genuinely help

- project-wide search and replace
- import a folder from disk (`webkitdirectory`) and export a project as a zip
- a "compare two commits" view
- accessibility passes with a screen reader
- translations (the app is English + Persian today; more are welcome)

Open an issue before starting anything large, so we do not both build the same thing.
