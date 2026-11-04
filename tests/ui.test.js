/* End-to-end smoke test of the Anbar UI in jsdom.
   Run: NODE_PATH=<node_modules> node tests/ui.test.js */
require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) { passed++; console.log('  ✓', name); }
  else { failures.push(name + (detail ? ' — ' + detail : '')); console.log('  ✗', name, detail || ''); }
}

function waitFor(fn, timeout) {
  const limit = Date.now() + (timeout || 6000);
  return new Promise((resolve, reject) => {
    (function tick() {
      let value;
      try { value = fn(); } catch (err) { value = null; }
      if (value) return resolve(value);
      if (Date.now() > limit) return reject(new Error('timed out waiting for a condition'));
      setTimeout(tick, 40);
    })();
  });
}

(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '');

  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.indexedDB = global.indexedDB;
  window.IDBKeyRange = global.IDBKeyRange;
  if (!window.crypto) window.crypto = {};
  if (!window.crypto.randomUUID) {
    let n = 0;
    window.crypto.randomUUID = () => 'test-id-' + (++n);
  }

  const errors = [];
  window.addEventListener('error', (event) => errors.push(String(event.message)));
  const originalError = window.console.error;
  window.console.error = function () {
    errors.push(Array.from(arguments).join(' '));
    originalError.apply(window.console, arguments);
  };

  console.log('ui smoke test');

  ['diff.js', 'store.js', 'app.js'].forEach((file) => {
    window.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', file), 'utf8'));
  });

  await waitFor(() => window.document.querySelector('.brand__name'));
  const doc = window.document;

  check('sidebar brand renders', doc.querySelector('.brand__name').textContent === 'Anbar');
  check('dashboard heading renders', /Your projects/.test(doc.querySelector('.dash__title').textContent));
  check('empty state offers the demo project', !!doc.querySelector('[data-action="demo-project"]'));

  // Create the demo project through the real click handler.
  doc.querySelector('[data-action="demo-project"]').click();
  await waitFor(() => doc.querySelector('.repo__name'), 8000);

  check('project view opens', doc.querySelector('.repo__name').textContent === 'anbar-demo');
  check('three tabs render', doc.querySelectorAll('.tab').length === 3);
  check('file tree lists the top-level files', doc.querySelectorAll('.tree__row--file').length === 2,
    'found ' + doc.querySelectorAll('.tree__row--file').length);
  check('folders are shown collapsed', doc.querySelectorAll('.tree__row--dir').length === 1);
  doc.querySelector('.tree__row--dir').click();
  await waitFor(() => doc.querySelectorAll('.tree__row--file').length === 4);
  check('expanding a folder reveals its files', doc.querySelectorAll('.tree__row--file').length === 4,
    'found ' + doc.querySelectorAll('.tree__row--file').length);
  check('editor loads the first file', !!doc.querySelector('#editor'));
  check('editor shows file content', /Anbar demo|greeting|:root|Ideas/.test(doc.querySelector('#editor').value));

  const pending = doc.querySelector('.tree__pending');
  check('pending changes are detected', /uncommitted/.test(pending.textContent), pending.textContent);
  check('commit button is enabled when there are changes', !doc.querySelector('[data-action="commit"]').disabled);

  // Changes tab
  doc.querySelector('.tab[data-tab="changes"]').click();
  await waitFor(() => doc.querySelector('.changeRow'));
  check('changes tab lists the edited file', !!doc.querySelector('.changeRow'));
  check('diff view renders rows', doc.querySelectorAll('.diff__row').length > 0,
    'rows: ' + doc.querySelectorAll('.diff__row').length);

  // History tab
  doc.querySelector('.tab[data-tab="history"]').click();
  await waitFor(() => doc.querySelector('.commit'));
  check('history shows the first commit', doc.querySelectorAll('.commit').length === 1);
  check('commit shows a short hash', /^[0-9a-z-]{4,7}$/i.test(doc.querySelector('.commit__hash').textContent),
    doc.querySelector('.commit__hash').textContent);

  // Back to code, open another file through the tree
  doc.querySelector('.tab[data-tab="code"]').click();
  await waitFor(() => doc.querySelector('#editor'));
  const before = doc.querySelector('#editor').value;
  const fileButtons = Array.from(doc.querySelectorAll('[data-action="select-file"]'));
  const target = fileButtons.find((b) => /README\.md$/.test(b.dataset.path));
  target.click();
  await waitFor(() => doc.querySelector('#editor') && doc.querySelector('#editor').value !== before);
  check('selecting another file swaps the editor content', /# Anbar demo/.test(doc.querySelector('#editor').value));

  // Typing marks the file dirty and autosaves
  const area = doc.querySelector('#editor');
  area.value = area.value + '\nEdited by the test.\n';
  area.dispatchEvent(new window.Event('input', { bubbles: true }));
  check('typing marks the file unsaved', /unsaved/.test(doc.querySelector('#save-state').textContent));
  await waitFor(() => /saved/.test(doc.querySelector('#save-state').textContent), 4000);
  check('autosave writes the change', /saved/.test(doc.querySelector('#save-state').textContent));

  check('no runtime errors were thrown', errors.length === 0, errors.join(' | '));

  console.log('\n' + passed + ' ui checks passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
  if (failures.length) {
    failures.forEach((f) => console.log('  FAILED:', f));
    process.exitCode = 1;
  }
  dom.window.close();
})().catch((err) => {
  console.error('ui test crashed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
