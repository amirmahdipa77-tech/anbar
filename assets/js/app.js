/*!
 * Anbar — offline code workspace
 * UI layer. Vanilla JS, no build step, no dependencies.
 * MIT License — Amirmahdi Pop
 */
(function (global) {
  'use strict';

  var Store = global.AnbarStore;
  var Diff = global.AnbarDiff;

  var state = {
    repos: [],
    repo: null,
    files: [],
    commits: [],
    changes: [],
    path: null,
    tab: 'code',
    diffPath: null,
    openDirs: Object.create(null),
    query: '',
    settings: { author: 'You', theme: 'system' },
    installEvent: null
  };

  var ICONS = {
    branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="6" r="2.4"/><circle cx="7" cy="18" r="2.4"/><circle cx="17" cy="12" r="2.4"/><path d="M7 8.4v7.2"/><path d="M7 12h7.6"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h7a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12"/><path d="M10 11v5M14 11v5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>'
  };

  var editorNode = null;
  var editorPath = null;
  var saveTimer = null;

  /* --------------------------------------------------------------- helpers */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function extOf(path) {
    var m = /\.([A-Za-z0-9]+)$/.exec(path || '');
    return m ? m[1].toLowerCase() : '';
  }
  function relTime(ts) {
    if (!ts) return 'never';
    var s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return s + 's ago';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.round(h / 24);
    if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }
  function count(n, singular, plural) {
    return n + ' ' + (n === 1 ? singular : (plural || singular + 's'));
  }
  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  /* -------------------------------------------------------------- settings */

  function loadSettings() {
    try {
      var raw = global.localStorage.getItem('anbar-settings');
      if (raw) state.settings = Object.assign(state.settings, JSON.parse(raw));
    } catch (err) { /* ignore a corrupt settings blob */ }
    applyTheme();
  }
  function saveSettings() {
    try { global.localStorage.setItem('anbar-settings', JSON.stringify(state.settings)); } catch (err) { /* private mode */ }
  }
  function systemTheme() {
    try {
      return global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (err) { return 'dark'; }
  }

  function resolvedTheme() {
    var choice = state.settings.theme || 'system';
    return choice === 'system' ? systemTheme() : choice;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', resolvedTheme());
  }

  function watchSystemTheme() {
    if (!global.matchMedia) return;
    var query = global.matchMedia('(prefers-color-scheme: light)');
    var handler = function () { if ((state.settings.theme || 'system') === 'system') applyTheme(); };
    if (query.addEventListener) query.addEventListener('change', handler);
    else if (query.addListener) query.addListener(handler);
  }

  /* --------------------------------------------------------------- toasts */

  function toast(message, kind) {
    var root = $('#toast-root');
    if (!root) return;
    var node = el('div', 'toast toast--' + (kind || 'info'));
    node.innerHTML = '<span class="toast__dot"></span><span>' + esc(message) + '</span>';
    root.appendChild(node);
    setTimeout(function () {
      node.classList.add('toast--out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 320);
    }, 3200);
  }

  /* --------------------------------------------------------------- modals */

  function closeModal() {
    var root = $('#modal-root');
    if (root) { root.innerHTML = ''; root.classList.remove('is-open'); }
  }

  function openModal(spec) {
    return new Promise(function (resolve) {
      var root = $('#modal-root');
      root.innerHTML = '';
      root.classList.add('is-open');

      var card = el('div', 'modal');
      var head = el('div', 'modal__head');
      head.appendChild(el('h2', 'modal__title', spec.title));
      var close = el('button', 'icon-btn', '✕');
      close.setAttribute('aria-label', 'Close');
      close.addEventListener('click', function () { closeModal(); resolve(null); });
      head.appendChild(close);
      card.appendChild(head);

      if (spec.body) {
        var body = el('p', 'modal__body');
        body.textContent = spec.body;
        card.appendChild(body);
      }

      var form = el('form', 'modal__form');
      (spec.fields || []).forEach(function (field) {
        var wrap = el('label', 'field');
        wrap.appendChild(el('span', 'field__label', field.label));
        var input;
        if (field.type === 'textarea') {
          input = el('textarea', 'field__input');
          input.rows = field.rows || 4;
        } else if (field.type === 'select') {
          input = el('select', 'field__input');
          (field.options || []).forEach(function (option) {
            var value = typeof option === 'string' ? option : option.value;
            var label = typeof option === 'string' ? option : option.label;
            var node = el('option', '', label);
            node.value = value;
            input.appendChild(node);
          });
        } else {
          input = el('input', 'field__input');
          input.type = field.type || 'text';
        }
        input.name = field.name;
        input.value = field.value === undefined ? '' : field.value;
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.required) input.required = true;
        if (field.hint) wrap.appendChild(el('span', 'field__hint', field.hint));
        wrap.appendChild(input);
        form.appendChild(wrap);
      });

      var actions = el('div', 'modal__actions');
      var cancel = el('button', 'btn btn--ghost', spec.cancelLabel || 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { closeModal(); resolve(null); });
      var submit = el('button', 'btn btn--primary', spec.submitLabel || 'Save');
      submit.type = 'submit';
      if (spec.danger) submit.classList.add('btn--danger');
      actions.appendChild(cancel);
      actions.appendChild(submit);
      form.appendChild(actions);
      card.appendChild(form);

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var values = {};
        (spec.fields || []).forEach(function (field) {
          var input = form.querySelector('[name="' + field.name + '"]');
          values[field.name] = input ? input.value : '';
        });
        closeModal();
        resolve(values);
      });

      root.appendChild(card);
      var first = card.querySelector('input, textarea, select');
      if (first) { first.focus(); if (first.select) first.select(); }
    });
  }

  function confirmDialog(title, body, confirmLabel) {
    return openModal({
      title: title,
      body: body,
      fields: [],
      submitLabel: confirmLabel || 'Confirm',
      danger: true,
      cancelLabel: 'Cancel'
    }).then(function (values) { return values !== null; });
  }

  /* ---------------------------------------------------------- highlighting */

  var KEYWORDS = {
    js: 'const let var function return if else for while class extends new this async await import export from default try catch finally throw typeof instanceof of in null undefined true false break continue switch case do delete void yield static get set',
    ts: 'const let var function return if else for while class extends new this async await import export from default try catch finally throw typeof instanceof of in null undefined true false break continue switch case do delete void yield static interface type enum implements public private readonly',
    kt: 'val var fun class object interface data enum when if else for while return import package private public internal protected override open abstract sealed companion init constructor suspend by in is as null true false try catch finally throw object this super lateinit lazy const',
    java: 'public private protected class interface extends implements static final void int long double float boolean char String new return if else for while try catch finally throw import package this super null true false',
    py: 'def class return if elif else for while import from as try except finally raise with lambda None True False and or not in is pass break continue global yield async await self',
    json: 'true false null',
    css: 'color background display flex grid position absolute relative margin padding border transform transition animation important none auto',
    html: 'div span class id href src',
    sh: 'if then else fi for do done while case esac function echo export cd set local return',
    md: 'true false'
  };

  function keywordsFor(ext) {
    if (KEYWORDS[ext]) return KEYWORDS[ext];
    if (ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return KEYWORDS.js;
    if (ext === 'tsx') return KEYWORDS.ts;
    if (ext === 'kts') return KEYWORDS.kt;
    if (ext === 'yml' || ext === 'yaml') return 'true false null';
    return '';
  }

  function highlight(code, ext) {
    var kw = keywordsFor(ext);
    if (!kw) return esc(code);
    var hashComments = ['py', 'sh', 'yml', 'yaml', 'toml', 'rb', 'bash', 'zsh', 'conf'].indexOf(ext) !== -1;
    var pattern =
      '(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*' + (hashComments ? '|#[^\\n]*' : '') + ')' +
      '|("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)' +
      '|\\b(\\d+(?:\\.\\d+)?)\\b' +
      '|\\b(' + kw.split(' ').join('|') + ')\\b';
    var re = new RegExp(pattern, 'g');
    var out = '';
    var last = 0;
    var match;
    while ((match = re.exec(code)) !== null) {
      if (match.index > last) out += esc(code.slice(last, match.index));
      var cls = match[1] ? 'tok-com' : match[2] ? 'tok-str' : match[3] ? 'tok-num' : 'tok-kw';
      out += '<span class="' + cls + '">' + esc(match[0]) + '</span>';
      last = match.index + match[0].length;
      if (match[0].length === 0) re.lastIndex++;
    }
    out += esc(code.slice(last));
    return out;
  }

  /* ---------------------------------------------------------------- router */

  function go(hash) {
    if (location.hash === hash) { route(); return; }
    location.hash = hash;
  }

  function route() {
    var hash = location.hash.replace(/^#/, '');
    var parts = hash.split('/').filter(Boolean); // ['project', id]
    if (parts[0] === 'project' && parts[1]) {
      openProject(parts[1]);
    } else {
      state.repo = null;
      state.path = null;
      state.diffPath = null;
      editorNode = null;
      editorPath = null;
      renderDashboard();
    }
  }

  /* -------------------------------------------------------------- dashboard */

  async function renderDashboard() {
    state.repo = null;
    renderSidebar();
    var main = $('#main');
    main.innerHTML = '';
    main.className = 'main main--dashboard';

    var head = el('div', 'dash__head');
    var titles = el('div', '');
    titles.appendChild(el('h1', 'dash__title', 'Your projects'));
    var subtitle = state.repos.length
      ? count(state.repos.length, 'project') + ' stored on this device'
      : 'Nothing here yet — everything you create stays on this machine';
    titles.appendChild(el('p', 'dash__sub', subtitle));
    head.appendChild(titles);

    var tools = el('div', 'dash__tools');
    var search = el('input', 'search');
    search.type = 'search';
    search.placeholder = 'Search projects…';
    search.value = state.query;
    search.addEventListener('input', function () {
      state.query = search.value;
      renderCards();
    });
    tools.appendChild(search);
    var newBtn = el('button', 'btn btn--primary', 'New project');
    newBtn.dataset.action = 'new-project';
    tools.appendChild(newBtn);
    head.appendChild(tools);
    main.appendChild(head);

    var grid = el('div', 'grid');
    grid.id = 'project-grid';
    main.appendChild(grid);

    var statsBar = el('div', 'dash__foot');
    statsBar.id = 'dash-foot';
    main.appendChild(statsBar);

    renderCards();
  }

  async function renderCards() {
    var grid = $('#project-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var query = state.query.trim().toLowerCase();
    var repos = state.repos.filter(function (repo) {
      return !query || repo.name.toLowerCase().indexOf(query) !== -1 ||
        (repo.description || '').toLowerCase().indexOf(query) !== -1;
    });

    if (!repos.length) {
      var empty = el('div', 'empty');
      empty.innerHTML =
        '<div class="empty__jelly"></div>' +
        '<h2>' + (state.repos.length ? 'No project matches that search' : 'Start your first project') + '</h2>' +
        '<p>' + (state.repos.length
          ? 'Try a different word, or clear the search box.'
          : 'A project holds your files, your commits and their full history. Nothing leaves this device.') + '</p>';
      if (!state.repos.length) {
        var row = el('div', 'empty__actions');
        var a = el('button', 'btn btn--primary', 'Create a project');
        a.dataset.action = 'new-project';
        var b = el('button', 'btn btn--ghost', 'Load the demo project');
        b.dataset.action = 'demo-project';
        row.appendChild(a); row.appendChild(b);
        empty.appendChild(row);
      }
      grid.appendChild(empty);
      return;
    }

    var all = await Store.listRepos();
    state.repos = all;

    var index = 0;
    for (var i = 0; i < repos.length; i++) {
      var repo = repos[i];
      var info = await Store.stats(repo.id);
      var card = el('article', 'card card--' + (repo.accent || 'violet'));
      card.style.animationDelay = (index * 45) + 'ms';
      index++;
      card.dataset.action = 'open-project';
      card.dataset.id = repo.id;
      card.tabIndex = 0;

      var top = el('div', 'card__top');
      top.appendChild(el('span', 'card__dot'));
      var name = el('h3', 'card__name', repo.name);
      top.appendChild(name);
      card.appendChild(top);

      card.appendChild(el('p', 'card__desc', repo.description || 'No description yet.'));

      var meta = el('div', 'card__meta');
      meta.appendChild(el('span', '', count(info.files, 'file')));
      meta.appendChild(el('span', '', count(info.commits, 'commit')));
      meta.appendChild(el('span', '', 'updated ' + relTime(repo.updatedAt)));
      card.appendChild(meta);

      var foot = el('div', 'card__foot');
      var last = info.lastCommit;
      foot.appendChild(el('span', 'card__last', last ? '“' + last.message + '”' : 'no commits yet'));
      var del = el('button', 'icon-btn icon-btn--danger');
      del.innerHTML = ICONS.trash;
      del.title = 'Delete project';
      del.dataset.action = 'delete-project';
      del.dataset.id = repo.id;
      foot.appendChild(del);
      card.appendChild(foot);

      grid.appendChild(card);
    }

    var foot = $('#dash-foot');
    if (foot) {
      var files = 0, commits = 0;
      for (var r = 0; r < state.repos.length; r++) {
        var s = await Store.stats(state.repos[r].id);
        files += s.files; commits += s.commits;
      }
      foot.textContent = count(state.repos.length, 'project') + ' · ' + count(files, 'file') + ' · ' +
        count(commits, 'commit') + ' · stored offline on this device';
    }
  }

  /* --------------------------------------------------------------- sidebar */

  function renderSidebar() {
    var side = $('#sidebar');
    if (!side) return;
    side.innerHTML = '';

    var brand = el('div', 'brand');
    brand.innerHTML = '<div class="brand__mark">' + ICONS.branch + '</div><div><div class="brand__name">Anbar</div><div class="brand__tag">offline code vault</div></div>';
    brand.dataset.action = 'home';
    side.appendChild(brand);

    var list = el('nav', 'side__list');
    var label = el('div', 'side__label', 'Projects');
    list.appendChild(label);
    state.repos.forEach(function (repo) {
      var item = el('button', 'side__item');
      item.dataset.action = 'open-project';
      item.dataset.id = repo.id;
      if (state.repo && state.repo.id === repo.id) item.classList.add('is-active');
      item.innerHTML = '<span class="side__dot side__dot--' + (repo.accent || 'violet') + '"></span>' +
        '<span class="side__name">' + esc(repo.name) + '</span>';
      list.appendChild(item);
    });
    if (!state.repos.length) {
      list.appendChild(el('div', 'side__empty', 'No projects yet'));
    }
    side.appendChild(list);

    var foot = el('div', 'side__foot');
    var settings = el('button', 'side__link');
    settings.innerHTML = '<span class="side__ico">' + ICONS.gear + '</span>Settings';
    settings.dataset.action = 'settings';
    var install = el('button', 'side__link');
    install.innerHTML = '<span class="side__ico">' + ICONS.download + '</span>Install app';
    install.dataset.action = 'install';
    install.id = 'install-btn';
    if (!state.installEvent) install.classList.add('is-hidden');
    foot.appendChild(settings);
    foot.appendChild(install);
    foot.appendChild(el('div', 'side__note', 'No server. No account. No tracking.'));
    side.appendChild(foot);
  }

  /* --------------------------------------------------------------- project */

  async function openProject(id) {
    var repo = await Store.getRepo(id);
    if (!repo) { toast('That project no longer exists.', 'error'); go('#/'); return; }
    state.repo = repo;
    await refreshProject();
    renderSidebar();
    renderProject();
  }

  async function refreshProject() {
    if (!state.repo) return;
    state.files = await Store.listFiles(state.repo.id);
    state.commits = await Store.listCommits(state.repo.id);
    state.changes = await Store.pendingChanges(state.repo.id);
    if (state.path && !state.files.some(function (f) { return f.path === state.path; })) {
      state.path = state.files.length ? state.files[0].path : null;
    }
    if (!state.path && state.files.length) state.path = state.files[0].path;
  }

  function renderProject() {
    var main = $('#main');
    main.className = 'main main--project';
    main.innerHTML = '';

    var repo = state.repo;
    var head = el('div', 'repo__head');

    var left = el('div', 'repo__identity');
    var nameRow = el('div', 'repo__nameRow');
    nameRow.appendChild(el('span', 'repo__dot repo__dot--' + (repo.accent || 'violet')));
    nameRow.appendChild(el('h1', 'repo__name', repo.name));
    var branch = el('span', 'chip chip--branch');
    branch.innerHTML = '<span class="chip__ico">' + ICONS.branch + '</span>main';
    nameRow.appendChild(branch);
    left.appendChild(nameRow);
    left.appendChild(el('p', 'repo__desc', repo.description || 'No description yet.'));

    var meta = el('div', 'repo__meta');
    meta.appendChild(el('span', '', count(state.files.length, 'file')));
    meta.appendChild(el('span', '', count(state.commits.length, 'commit')));
    meta.appendChild(el('span', '', count(state.changes.length, 'pending change')));
    left.appendChild(meta);
    head.appendChild(left);

    var actions = el('div', 'repo__actions');
    var rename = el('button', 'btn btn--ghost btn--sm', 'Rename');
    rename.dataset.action = 'rename-project';
    actions.appendChild(rename);
    var commitBtn = el('button', 'btn btn--primary', 'Commit changes');
    commitBtn.dataset.action = 'commit';
    if (!state.changes.length) commitBtn.disabled = true;
    actions.appendChild(commitBtn);
    head.appendChild(actions);
    main.appendChild(head);

    var tabs = el('div', 'tabs');
    [['code', 'Code'], ['changes', 'Changes' + (state.changes.length ? ' (' + state.changes.length + ')' : '')], ['history', 'History']]
      .forEach(function (pair) {
        var tab = el('button', 'tab' + (state.tab === pair[0] ? ' is-active' : ''), pair[1]);
        tab.dataset.action = 'tab';
        tab.dataset.tab = pair[0];
        tabs.appendChild(tab);
      });
    main.appendChild(tabs);

    var layout = el('div', 'layout');
    layout.appendChild(buildTreePanel());
    layout.appendChild(buildPane());
    main.appendChild(layout);
  }

  /* ------------------------------------------------------------ tree panel */

  function buildTree() {
    var root = { name: '', dirs: Object.create(null), files: [] };
    state.files.forEach(function (file) {
      var parts = file.path.split('/');
      var node = root;
      for (var i = 0; i < parts.length - 1; i++) {
        var key = parts[i];
        if (!node.dirs[key]) node.dirs[key] = { name: key, dirs: Object.create(null), files: [] };
        node = node.dirs[key];
      }
      node.files.push(file);
    });
    return root;
  }

  function buildTreePanel() {
    var panel = el('aside', 'tree');
    var head = el('div', 'tree__head');
    head.appendChild(el('span', 'tree__title', 'Files'));
    var addFile = el('button', 'icon-btn');
    addFile.innerHTML = ICONS.plus;
    addFile.title = 'New file (use / in the name to create a folder)';
    addFile.dataset.action = 'new-file';
    head.appendChild(addFile);
    panel.appendChild(head);

    var body = el('div', 'tree__body');
    if (!state.files.length) {
      var empty = el('div', 'tree__empty', 'No files yet. Create one with ＋.');
      body.appendChild(empty);
    } else {
      var root = buildTree();
      renderDir(body, root, '');
    }
    panel.appendChild(body);

    var foot = el('div', 'tree__foot');
    var changeCount = state.changes.length;
    var pending = el('button', 'tree__pending' + (changeCount ? ' is-dirty' : ''),
      changeCount ? count(changeCount, 'uncommitted file') : 'Everything committed');
    pending.dataset.action = 'tab';
    pending.dataset.tab = 'changes';
    foot.appendChild(pending);
    panel.appendChild(foot);
    return panel;
  }

  function renderDir(container, node, prefix) {
    var dirNames = Object.keys(node.dirs).sort();
    dirNames.forEach(function (dirName) {
      var path = prefix ? prefix + '/' + dirName : dirName;
      var isOpen = state.openDirs[path];
      var row = el('button', 'tree__row tree__row--dir');
      row.dataset.action = 'toggle-dir';
      row.dataset.path = path;
      row.innerHTML = '<span class="tree__caret">' + (isOpen ? '▾' : '▸') + '</span>' +
        '<span class="tree__icon tree__icon--svg">' + ICONS.folder + '</span>' +
        '<span class="tree__name">' + esc(dirName) + '</span>';
      container.appendChild(row);
      if (isOpen) {
        var childWrap = el('div', 'tree__children');
        renderDir(childWrap, node.dirs[dirName], path);
        container.appendChild(childWrap);
      }
    });

    node.files.forEach(function (file) {
      var changed = state.changes.some(function (c) { return c.path === file.path; });
      var row = el('div', 'tree__row tree__row--file' + (state.path === file.path ? ' is-active' : ''));
      var btn = el('button', 'tree__fileBtn');
      btn.dataset.action = 'select-file';
      btn.dataset.path = file.path;
      btn.innerHTML = '<span class="tree__icon">' + fileIcon(file.path) + '</span>' +
        '<span class="tree__name">' + esc(file.path.split('/').pop()) + '</span>' +
        (changed ? '<span class="tree__dirty"></span>' : '');
      row.appendChild(btn);

      var tools = el('div', 'tree__tools');
      var ren = el('button', 'icon-btn icon-btn--sm', '✎');
      ren.title = 'Rename';
      ren.dataset.action = 'rename-file';
      ren.dataset.path = file.path;
      var del = el('button', 'icon-btn icon-btn--sm icon-btn--danger', '✕');
      del.title = 'Delete';
      del.dataset.action = 'delete-file';
      del.dataset.path = file.path;
      tools.appendChild(ren);
      tools.appendChild(del);
      row.appendChild(tools);
      container.appendChild(row);
    });
  }

  function fileIcon(path) {
    var ext = extOf(path);
    if (['js', 'mjs', 'cjs', 'jsx'].indexOf(ext) !== -1) return 'JS';
    if (['ts', 'tsx'].indexOf(ext) !== -1) return 'TS';
    if (['kt', 'kts'].indexOf(ext) !== -1) return 'KT';
    if (ext === 'py') return 'PY';
    if (ext === 'json') return '{}';
    if (ext === 'md') return 'MD';
    if (['css', 'scss'].indexOf(ext) !== -1) return 'CS';
    if (ext === 'html') return '<>';
    return '·';
  }

  /* ------------------------------------------------------------------ pane */

  function buildPane() {
    var pane = el('section', 'pane');
    if (state.tab === 'changes') return buildChangesPane();
    if (state.tab === 'history') return buildHistoryPane();

    if (!state.path) {
      var empty = el('div', 'pane__empty');
      empty.innerHTML = '<h2>No file open</h2><p>Pick a file on the left, or create one with ＋.</p>';
      pane.appendChild(empty);
      return pane;
    }

    var file = state.files.filter(function (f) { return f.path === state.path; })[0];
    if (!file) {
      pane.appendChild(el('div', 'pane__empty', 'That file is gone.'));
      return pane;
    }

    var bar = el('div', 'pane__bar');
    bar.appendChild(el('span', 'pane__path', file.path));
    var saveState = el('span', 'pane__saved', 'saved');
    saveState.id = 'save-state';
    bar.appendChild(saveState);
    var saveBtn = el('button', 'btn btn--ghost btn--sm', 'Save');
    saveBtn.dataset.action = 'save-file';
    bar.appendChild(saveBtn);
    pane.appendChild(bar);

    if (editorNode && editorPath === file.path) {
      pane.appendChild(editorNode);
      return pane;
    }

    var wrap = el('div', 'editor');
    var gutter = el('div', 'editor__gutter');
    gutter.id = 'gutter';
    var code = el('pre', 'editor__highlight');
    code.id = 'highlight';
    code.setAttribute('aria-hidden', 'true');
    var area = el('textarea', 'editor__input');
    area.id = 'editor';
    area.spellcheck = false;
    area.value = file.content;
    area.setAttribute('wrap', 'off');

    function paint() {
      var text = area.value;
      var lineCount = text.split('\n').length;
      var nums = [];
      for (var i = 1; i <= lineCount; i++) nums.push(i);
      gutter.textContent = nums.join('\n');
      code.innerHTML = highlight(text, extOf(file.path)) + '\n';
      syncScroll();
    }
    function syncScroll() {
      gutter.scrollTop = area.scrollTop;
      code.scrollLeft = area.scrollLeft;
      code.scrollTop = area.scrollTop;
    }

    area.addEventListener('input', function () {
      paint();
      var badge = $('#save-state');
      if (badge) { badge.textContent = 'unsaved…'; badge.classList.add('is-dirty'); }
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { persistFile(file.path, area.value, true); }, 700);
    });
    area.addEventListener('scroll', syncScroll);
    area.addEventListener('keydown', function (event) {
      if (event.key === 'Tab') {
        event.preventDefault();
        var start = area.selectionStart, end = area.selectionEnd;
        area.value = area.value.slice(0, start) + '  ' + area.value.slice(end);
        area.selectionStart = area.selectionEnd = start + 2;
        paint();
      }
    });

    wrap.appendChild(gutter);
    wrap.appendChild(code);
    wrap.appendChild(area);
    pane.appendChild(wrap);

    editorNode = wrap;
    editorPath = file.path;
    paint();
    setTimeout(function () { area.focus(); }, 30);
    return pane;
  }

  function buildChangesPane() {
    var pane = el('section', 'pane');
    var bar = el('div', 'pane__bar');
    bar.appendChild(el('span', 'pane__path', 'Changes since the last commit'));
    pane.appendChild(bar);

    if (!state.changes.length) {
      var empty = el('div', 'pane__empty');
      empty.innerHTML = '<h2>Working tree clean</h2><p>Edit a file and the changes will show up here, ready to commit.</p>';
      pane.appendChild(empty);
      return pane;
    }

    var list = el('div', 'changeList');
    state.changes.forEach(function (change) {
      var row = el('button', 'changeRow' + (state.diffPath === change.path ? ' is-active' : ''));
      row.dataset.action = 'show-diff';
      row.dataset.path = change.path;
      row.innerHTML =
        '<span class="status status--' + change.status + '">' + change.status.charAt(0).toUpperCase() + '</span>' +
        '<span class="changeRow__path">' + esc(change.path) + '</span>' +
        '<span class="changeRow__stat"><span class="add">+' + change.additions + '</span> <span class="del">−' + change.deletions + '</span></span>';
      list.appendChild(row);
    });
    pane.appendChild(list);

    var target = state.changes.filter(function (c) { return c.path === state.diffPath; })[0] || state.changes[0];
    if (target) pane.appendChild(buildDiffView(target));
    return pane;
  }

  function buildHistoryPane() {
    var pane = el('section', 'pane');
    var bar = el('div', 'pane__bar');
    bar.appendChild(el('span', 'pane__path', 'Commit history'));
    pane.appendChild(bar);

    if (!state.commits.length) {
      var empty = el('div', 'pane__empty');
      empty.innerHTML = '<h2>No commits yet</h2><p>Write something, then hit <b>Commit changes</b>. Every commit keeps a full snapshot you can restore.</p>';
      pane.appendChild(empty);
      return pane;
    }

    var list = el('div', 'history');
    state.commits.forEach(function (commit, index) {
      var item = el('div', 'commit');
      var top = el('div', 'commit__top');
      top.innerHTML =
        '<span class="commit__hash">' + esc(commit.id.slice(0, 7)) + '</span>' +
        '<span class="commit__msg">' + esc(commit.message) + '</span>' +
        (index === 0 ? '<span class="chip chip--head">HEAD</span>' : '');
      item.appendChild(top);

      var meta = el('div', 'commit__meta');
      meta.innerHTML = esc(commit.author) + ' · ' + relTime(commit.createdAt) + ' · ' +
        count(commit.filesChanged, 'file') + ' · <span class="add">+' + (commit.additions || 0) +
        '</span> <span class="del">−' + (commit.deletions || 0) + '</span>';
      item.appendChild(meta);

      var actions = el('div', 'commit__actions');
      var view = el('button', 'btn btn--ghost btn--sm', 'View diff');
      view.dataset.action = 'commit-diff';
      view.dataset.id = commit.id;
      actions.appendChild(view);
      var restore = el('button', 'btn btn--ghost btn--sm', 'Restore this version');
      restore.dataset.action = 'restore-commit';
      restore.dataset.id = commit.id;
      actions.appendChild(restore);
      item.appendChild(actions);

      if (state.diffPath === commit.id) item.appendChild(buildCommitDiff(commit));
      list.appendChild(item);
    });
    pane.appendChild(list);
    return pane;
  }

  function buildCommitDiff(commit) {
    var wrap = el('div', 'diffWrap');
    var parentTree = null;
    if (commit.parent) {
      var parent = state.commits.filter(function (c) { return c.id === commit.parent; })[0];
      parentTree = parent ? parent.tree : null;
    }
    var changes = Diff.diffTrees(parentTree || {}, commit.tree);
    if (!changes.length) {
      wrap.appendChild(el('div', 'pane__empty', 'This commit changed nothing.'));
      return wrap;
    }
    changes.forEach(function (change) {
      var head = el('div', 'diffFile__head');
      head.innerHTML = '<span class="status status--' + change.status + '">' + change.status.charAt(0).toUpperCase() + '</span>' +
        '<span>' + esc(change.path) + '</span>' +
        '<span class="changeRow__stat"><span class="add">+' + change.additions + '</span> <span class="del">−' + change.deletions + '</span></span>';
      wrap.appendChild(head);
      wrap.appendChild(buildDiffView(change));
    });
    return wrap;
  }

  function buildDiffView(change) {
    var box = el('div', 'diff');
    var hunks = Diff.toHunks(change.ops, 3);
    hunks.forEach(function (hunk) {
      hunk.forEach(function (op) {
        var row = el('div', 'diff__row diff__row--' + op.type);
        var left = op.aLine === null ? '' : op.aLine;
        var right = op.bLine === null ? '' : op.bLine;
        var sign = op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' ';
        row.innerHTML = '<span class="diff__num">' + left + '</span>' +
          '<span class="diff__num">' + right + '</span>' +
          '<span class="diff__sign">' + sign + '</span>' +
          '<span class="diff__text">' + (esc(op.text) || '&nbsp;') + '</span>';
        box.appendChild(row);
      });
    });
    if (!hunks.length) box.appendChild(el('div', 'pane__empty', 'No line changes.'));
    return box;
  }

  /* -------------------------------------------------------------- mutations */

  async function persistFile(path, content, silent) {
    if (!state.repo) return;
    try {
      await Store.writeFile(state.repo.id, path, content);
      var badge = $('#save-state');
      if (badge) { badge.textContent = 'saved'; badge.classList.remove('is-dirty'); }
      state.changes = await Store.pendingChanges(state.repo.id);
      var pendingBtn = $('.tree__pending');
      if (pendingBtn) {
        pendingBtn.textContent = state.changes.length ? count(state.changes.length, 'uncommitted file') : 'Everything committed';
        pendingBtn.classList.toggle('is-dirty', state.changes.length > 0);
      }
      var tabChanges = $('.tab[data-tab="changes"]');
      if (tabChanges) tabChanges.textContent = 'Changes' + (state.changes.length ? ' (' + state.changes.length + ')' : '');
      if (!silent) toast('Saved', 'ok');
    } catch (err) {
      toast(err.message || 'Could not save the file.', 'error');
    }
  }

  async function reloadAndRender() {
    state.repos = await Store.listRepos();
    if (state.repo) {
      state.repo = await Store.getRepo(state.repo.id);
      await refreshProject();
      renderProject();
    } else {
      renderDashboard();
    }
    renderSidebar();
  }

  var actions = {
    home: function () { go('#/'); },
    'open-project': function (node) { go('#/project/' + node.dataset.id); },
    'new-project': async function () {
      var values = await openModal({
        title: 'New project',
        fields: [
          { name: 'name', label: 'Project name', placeholder: 'my-first-app', required: true },
          { name: 'description', label: 'Description', placeholder: 'What is this project about?' },
          { name: 'author', label: 'Your name', value: state.settings.author }
        ],
        submitLabel: 'Create project'
      });
      if (!values) return;
      try {
        var repo = await Store.createRepo(values);
        if (values.author && values.author.trim()) {
          state.settings.author = values.author.trim();
          saveSettings();
        }
        await Store.writeFile(repo.id, 'README.md', '# ' + repo.name + '\n\n' + (repo.description || '') + '\n');
        await Store.commit(repo.id, 'Initial commit', state.settings.author);
        toast('Project created', 'ok');
        state.repos = await Store.listRepos();
        go('#/project/' + repo.id);
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    'demo-project': async function () {
      try {
        var repo = await Store.createRepo({
          name: 'anbar-demo',
          description: 'A tiny sample project — edit a file, commit it, then look at History.',
          author: state.settings.author
        });
        var files = {
          'README.md': '# Anbar demo\n\nThis project exists so you can see commits, diffs and history working.\n\n1. Open `src/greeting.js`\n2. Change the text\n3. Hit **Commit changes**\n4. Open the **History** tab and view the diff\n',
          'src/greeting.js': 'export function greeting(name) {\n  return "Hello, " + name + "!";\n}\n\nexport function farewell(name) {\n  return "Bye, " + name + ".";\n}\n',
          'src/theme.css': ':root {\n  --accent: #7c6cff;\n  --jelly: cubic-bezier(.34, 1.56, .64, 1);\n}\n\nbutton {\n  transition: transform .28s var(--jelly);\n}\n',
          'notes.txt': 'Ideas\n- add a branch view\n- add a file search\n- export a project as a zip\n'
        };
        var paths = Object.keys(files);
        for (var i = 0; i < paths.length; i++) await Store.writeFile(repo.id, paths[i], files[paths[i]]);
        await Store.commit(repo.id, 'Initial commit: demo project', state.settings.author);
        await Store.writeFile(repo.id, 'notes.txt', files['notes.txt'] + '- make the diff view prettier\n');
        toast('Demo project created', 'ok');
        state.repos = await Store.listRepos();
        go('#/project/' + repo.id);
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    'delete-project': async function (node, event) {
      event.stopPropagation();
      var repo = await Store.getRepo(node.dataset.id);
      if (!repo) return;
      var ok = await confirmDialog('Delete “' + repo.name + '”?',
        'This removes the project, every file and every commit from this device. It cannot be undone.', 'Delete for good');
      if (!ok) return;
      await Store.deleteRepo(repo.id);
      if (state.repo && state.repo.id === repo.id) { state.repo = null; go('#/'); }
      state.repos = await Store.listRepos();
      renderDashboard();
      renderSidebar();
      toast('Project deleted', 'ok');
    },
    'rename-project': async function () {
      var values = await openModal({
        title: 'Rename project',
        fields: [
          { name: 'name', label: 'Name', value: state.repo.name, required: true },
          { name: 'description', label: 'Description', value: state.repo.description || '' }
        ],
        submitLabel: 'Save'
      });
      if (!values) return;
      try {
        await Store.updateRepo(state.repo.id, { name: values.name.trim(), description: values.description });
        await reloadAndRender();
        toast('Project updated', 'ok');
      } catch (err) { toast(err.message, 'error'); }
    },
    tab: function (node) {
      state.tab = node.dataset.tab;
      if (state.tab !== 'history') state.diffPath = null;
      renderProject();
    },
    'toggle-dir': function (node) {
      var path = node.dataset.path;
      state.openDirs[path] = !state.openDirs[path];
      renderProject();
    },
    'select-file': function (node) {
      state.path = node.dataset.path;
      state.tab = 'code';
      renderProject();
    },
    'new-file': async function () {
      var values = await openModal({
        title: 'New file',
        fields: [{ name: 'path', label: 'Path', placeholder: 'src/app.js', required: true, hint: 'Use / to put it in a folder — the folder is created for you.' }],
        submitLabel: 'Create file'
      });
      if (!values) return;
      try {
        var path = values.path.trim();
        if (state.files.some(function (f) { return f.path === path; })) throw new Error('That file already exists.');
        await Store.writeFile(state.repo.id, path, '');
        state.path = path;
        state.tab = 'code';
        await refreshProject();
        renderProject();
        renderSidebar();
        toast('File created', 'ok');
      } catch (err) { toast(err.message, 'error'); }
    },
    'rename-file': async function (node, event) {
      event.stopPropagation();
      var from = node.dataset.path;
      var values = await openModal({
        title: 'Rename file',
        fields: [{ name: 'path', label: 'New path', value: from, required: true }],
        submitLabel: 'Rename'
      });
      if (!values) return;
      try {
        await Store.renameFile(state.repo.id, from, values.path.trim());
        if (state.path === from) state.path = values.path.trim();
        await refreshProject();
        renderProject();
        toast('File renamed', 'ok');
      } catch (err) { toast(err.message, 'error'); }
    },
    'delete-file': async function (node, event) {
      event.stopPropagation();
      var path = node.dataset.path;
      var ok = await confirmDialog('Delete ' + path + '?', 'The file is removed from the working tree. The last commit still holds a copy you can restore.', 'Delete file');
      if (!ok) return;
      await Store.deleteFile(state.repo.id, path);
      if (state.path === path) { state.path = null; editorNode = null; editorPath = null; }
      await refreshProject();
      renderProject();
      toast('File deleted', 'ok');
    },
    'save-file': async function () {
      var area = $('#editor');
      if (area) await persistFile(state.path, area.value);
    },
    commit: async function () {
      if (!state.changes.length) { toast('Nothing to commit.', 'info'); return; }
      var values = await openModal({
        title: 'Commit ' + count(state.changes.length, 'file'),
        fields: [
          { name: 'message', label: 'Commit message', placeholder: 'Fix the greeting text', required: true },
          { name: 'author', label: 'Author', value: state.settings.author }
        ],
        submitLabel: 'Commit'
      });
      if (!values) return;
      try {
        var area = $('#editor');
        if (area && state.path) await persistFile(state.path, area.value, true);
        await Store.commit(state.repo.id, values.message, values.author);
        if (values.author && values.author.trim()) {
          state.settings.author = values.author.trim();
          saveSettings();
        }
        await reloadAndRender();
        toast('Committed', 'ok');
      } catch (err) { toast(err.message, 'error'); }
    },
    'show-diff': function (node) {
      state.diffPath = node.dataset.path;
      renderProject();
    },
    'commit-diff': function (node) {
      state.diffPath = state.diffPath === node.dataset.id ? null : node.dataset.id;
      renderProject();
    },
    'restore-commit': async function (node) {
      var commit = state.commits.filter(function (c) { return c.id === node.dataset.id; })[0];
      if (!commit) return;
      var ok = await confirmDialog('Restore “' + commit.message + '”?',
        'Every file goes back to how it looked in this commit. Nothing is committed for you — the restored files show up as pending changes you can review and commit.', 'Restore files');
      if (!ok) return;
      await Store.restoreCommit(state.repo.id, commit.id);
      editorNode = null;
      editorPath = null;
      await reloadAndRender();
      toast('Files restored — review the changes, then commit', 'ok');
    },
    settings: async function () {
      var values = await openModal({
        title: 'Settings',
        fields: [
          { name: 'author', label: 'Default author name', value: state.settings.author },
          {
            name: 'theme',
            label: 'Appearance',
            type: 'select',
            value: state.settings.theme || 'system',
            options: [
              { value: 'system', label: 'Match the system' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' }
            ]
          }
        ],
        submitLabel: 'Save'
      });
      if (!values) return;
      state.settings.author = values.author || 'You';
      var picked = String(values.theme || 'system').toLowerCase();
      state.settings.theme = ['system', 'dark', 'light'].indexOf(picked) === -1 ? 'system' : picked;
      saveSettings();
      applyTheme();
      toast('Settings saved', 'ok');
    },
    export: async function () {
      var payload = await Store.exportAll();
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'anbar-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('Backup downloaded', 'ok');
    },
    import: function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = async function () {
          try {
            var payload = JSON.parse(String(reader.result));
            var imported = await Store.importAll(payload, 'merge');
            state.repos = await Store.listRepos();
            renderDashboard();
            renderSidebar();
            toast('Imported ' + count(imported, 'project'), 'ok');
          } catch (err) { toast(err.message || 'Could not read that file.', 'error'); }
        };
        reader.readAsText(file);
      });
      input.click();
    },
    install: function () {
      if (!state.installEvent) { toast('Use your browser menu → “Install app”.', 'info'); return; }
      state.installEvent.prompt();
      state.installEvent = null;
      var btn = $('#install-btn');
      if (btn) btn.classList.add('is-hidden');
    }
  };

  /* ----------------------------------------------------------------- wiring */

  function onClick(event) {
    var node = event.target.closest('[data-action]');
    if (!node) {
      if (event.target.id === 'modal-root') closeModal();
      return;
    }
    var action = node.dataset.action;
    if (actions[action]) {
      event.preventDefault();
      actions[action](node, event);
    }
  }

  function onKey(event) {
    if (event.key === 'Escape') closeModal();
    var mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      var area = $('#editor');
      if (area && state.path) persistFile(state.path, area.value);
    }
    if (mod && event.key === 'Enter' && state.repo) {
      event.preventDefault();
      actions.commit();
    }
    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      var search = $('.search');
      if (search) search.focus();
    }
  }

  async function boot() {
    loadSettings();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', route);
    watchSystemTheme();

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      state.installEvent = event;
      var btn = $('#install-btn');
      if (btn) btn.classList.remove('is-hidden');
    });

    try {
      state.repos = await Store.listRepos();
    } catch (err) {
      toast(err.message, 'error');
      state.repos = [];
    }

    if (!location.hash) location.hash = '#/';
    route();

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline shell is a bonus, not a requirement */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
