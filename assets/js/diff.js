/*!
 * Anbar — line diff engine
 * Pure functions, no DOM, no dependencies. Loadable in a browser or in Node.
 * MIT License — Amirmahdi Pop
 */
(function (global) {
  'use strict';

  /** Split text into lines, tolerating CRLF and missing trailing newline. */
  function splitLines(text) {
    if (text === null || text === undefined) return [];
    var normalised = String(text).replace(/\r\n?/g, '\n');
    if (normalised === '') return []; // an empty file has no lines at all
    var lines = normalised.split('\n');
    if (lines[lines.length - 1] === '') lines.pop(); // a final newline does not add a line
    return lines;
  }

  /** Coarse fallback for very large inputs: everything removed, everything added. */
  function coarseDiff(a, b) {
    var ops = [];
    for (var i = 0; i < a.length; i++) ops.push({ type: 'del', text: a[i], aLine: i + 1, bLine: null });
    for (var j = 0; j < b.length; j++) ops.push({ type: 'add', text: b[j], aLine: null, bLine: j + 1 });
    return ops;
  }

  /**
   * Line-based diff using the classic LCS table.
   * Returns [{type:'equal'|'add'|'del', text, aLine, bLine}].
   */
  function diffLines(oldText, newText) {
    var a = splitLines(oldText);
    var b = splitLines(newText);
    var n = a.length, m = b.length;

    if (n === 0 && m === 0) return [];
    if (n === 0) return coarseDiff([], b);
    if (m === 0) return coarseDiff(a, []);

    // Guard: the table is O(n*m); fall back for very large files.
    if (n * m > 4000000) return coarseDiff(a, b);

    var width = m + 1;
    var dp = new Uint32Array((n + 1) * width);

    for (var i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) {
          dp[i * width + j] = dp[(i + 1) * width + (j + 1)] + 1;
        } else {
          var down = dp[(i + 1) * width + j];
          var right = dp[i * width + (j + 1)];
          dp[i * width + j] = down >= right ? down : right;
        }
      }
    }

    var ops = [];
    var x = 0, y = 0;
    while (x < n && y < m) {
      if (a[x] === b[y]) {
        ops.push({ type: 'equal', text: a[x], aLine: x + 1, bLine: y + 1 });
        x++; y++;
      } else if (dp[(x + 1) * width + y] >= dp[x * width + (y + 1)]) {
        ops.push({ type: 'del', text: a[x], aLine: x + 1, bLine: null });
        x++;
      } else {
        ops.push({ type: 'add', text: b[y], aLine: null, bLine: y + 1 });
        y++;
      }
    }
    while (x < n) { ops.push({ type: 'del', text: a[x], aLine: x + 1, bLine: null }); x++; }
    while (y < m) { ops.push({ type: 'add', text: b[y], aLine: null, bLine: y + 1 }); y++; }

    return ops;
  }

  function countOps(ops) {
    var additions = 0, deletions = 0;
    for (var i = 0; i < ops.length; i++) {
      if (ops[i].type === 'add') additions++;
      else if (ops[i].type === 'del') deletions++;
    }
    return { additions: additions, deletions: deletions };
  }

  /**
   * Compare two working trees ({path: content} maps).
   * Returns [{path, status:'added'|'modified'|'deleted', additions, deletions, ops}].
   */
  function diffTrees(oldTree, newTree) {
    var oldT = oldTree || {};
    var newT = newTree || {};
    var seen = Object.create(null);
    var paths = [];
    var key;

    for (key in oldT) if (Object.prototype.hasOwnProperty.call(oldT, key)) seen[key] = 1;
    for (key in newT) if (Object.prototype.hasOwnProperty.call(newT, key)) seen[key] = 1;
    for (key in seen) paths.push(key);
    paths.sort();

    var out = [];
    for (var i = 0; i < paths.length; i++) {
      var path = paths[i];
      var inOld = Object.prototype.hasOwnProperty.call(oldT, path);
      var inNew = Object.prototype.hasOwnProperty.call(newT, path);
      var before = inOld ? oldT[path] : '';
      var after = inNew ? newT[path] : '';
      if (inOld && inNew && before === after) continue;

      var ops = diffLines(before, after);
      var counts = countOps(ops);
      out.push({
        path: path,
        status: !inOld ? 'added' : !inNew ? 'deleted' : 'modified',
        additions: counts.additions,
        deletions: counts.deletions,
        ops: ops
      });
    }
    return out;
  }

  /** Collapse long runs of unchanged lines into hunks of context. */
  function toHunks(ops, context) {
    context = context === undefined ? 3 : context;
    var keep = new Array(ops.length);
    var i;
    for (i = 0; i < ops.length; i++) {
      if (ops[i].type !== 'equal') {
        for (var k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true;
      }
    }
    var hunks = [];
    var current = null;
    for (i = 0; i < ops.length; i++) {
      if (keep[i]) {
        if (!current) { current = []; hunks.push(current); }
        current.push(ops[i]);
      } else {
        current = null;
      }
    }
    return hunks;
  }

  var api = {
    splitLines: splitLines,
    diffLines: diffLines,
    diffTrees: diffTrees,
    countOps: countOps,
    toHunks: toHunks
  };

  global.AnbarDiff = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
