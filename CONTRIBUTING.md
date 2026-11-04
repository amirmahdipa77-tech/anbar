# Contributing to Anbar

Anbar is small on purpose. A feature should fit in your head, and a review should take ten minutes.

## Ground rules

1. **No network.** Not for fonts, not for analytics, not for crash reports. If a feature needs the
   internet, it does not belong in this app.
2. **No new runtime dependencies without a very good reason.** The app currently has no navigation
   library, no state library and no UI kit beyond its own primitives.
3. **No mocks in the test suite.** Storage tests run the real module against an in-memory
   AsyncStorage adapter.
4. **Destructive actions ask first.** Never delete data without a confirmation that names what is
   going away.
5. **Design rules** (see `docs/ARCHITECTURE.md` §6): flat surfaces, hairline separation, one accent,
   motion under 300 ms, nothing bouncy.

## Workflow

```bash
npm install
npm run typecheck
npm test
npx expo start           # run on a device with Expo Go
npx expo export --platform web   # or check it in a browser
```

Add a check with every change:

- pure logic → `tests/run.js` (diff section)
- storage behaviour → `tests/run.js` (storage section)
- anything visual → a screenshot in the PR description

## Ideas that would help

- branching on top of the snapshot model
- importing a folder from the device, exporting a single file
- optional encryption at rest with a native keystore
- accessibility pass with TalkBack
- translations (the app is English today; the README is English + Persian)

Open an issue before starting anything large.
