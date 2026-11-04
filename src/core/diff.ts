import type { Change, DiffOp, FileTree } from '../types';

/** Split text into lines. An empty file has no lines; a trailing newline adds none. */
export function splitLines(text: string | null | undefined): string[] {
  if (text === null || text === undefined) return [];
  const normalised = String(text).replace(/\r\n?/g, '\n');
  if (normalised === '') return [];
  const lines = normalised.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function coarse(a: string[], b: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  a.forEach((text, i) => ops.push({ type: 'del', text, aLine: i + 1, bLine: null }));
  b.forEach((text, j) => ops.push({ type: 'add', text, aLine: null, bLine: j + 1 }));
  return ops;
}

const MAX_CELLS = 4_000_000;

/** Classic LCS line diff, with a coarse fallback so a huge file never freezes the UI. */
export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const n = a.length;
  const m = b.length;

  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0) return coarse(a, b);
  if (n * m > MAX_CELLS) return coarse(a, b);

  const width = m + 1;
  const dp = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)]);
    }
  }

  const ops: DiffOp[] = [];
  let x = 0;
  let y = 0;
  while (x < n && y < m) {
    if (a[x] === b[y]) {
      ops.push({ type: 'equal', text: a[x], aLine: x + 1, bLine: y + 1 });
      x += 1;
      y += 1;
    } else if (dp[(x + 1) * width + y] >= dp[x * width + (y + 1)]) {
      ops.push({ type: 'del', text: a[x], aLine: x + 1, bLine: null });
      x += 1;
    } else {
      ops.push({ type: 'add', text: b[y], aLine: null, bLine: y + 1 });
      y += 1;
    }
  }
  while (x < n) {
    ops.push({ type: 'del', text: a[x], aLine: x + 1, bLine: null });
    x += 1;
  }
  while (y < m) {
    ops.push({ type: 'add', text: b[y], aLine: null, bLine: y + 1 });
    y += 1;
  }
  return ops;
}

export function countOps(ops: DiffOp[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  ops.forEach((op) => {
    if (op.type === 'add') additions += 1;
    else if (op.type === 'del') deletions += 1;
  });
  return { additions, deletions };
}

/** Compare two trees ({path: content}). Unchanged files are skipped. */
export function diffTrees(before: FileTree, after: FileTree): Change[] {
  const paths = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const changes: Change[] = [];

  paths.forEach((path) => {
    const inBefore = Object.prototype.hasOwnProperty.call(before, path);
    const inAfter = Object.prototype.hasOwnProperty.call(after, path);
    const oldText = inBefore ? before[path] : '';
    const newText = inAfter ? after[path] : '';
    if (inBefore && inAfter && oldText === newText) return;

    const ops = diffLines(oldText, newText);
    const { additions, deletions } = countOps(ops);
    changes.push({
      path,
      status: !inBefore ? 'added' : !inAfter ? 'deleted' : 'modified',
      additions,
      deletions,
      ops,
    });
  });

  return changes;
}

/** Keep `context` unchanged lines around every change, drop the rest. */
export function toHunks(ops: DiffOp[], context = 3): DiffOp[][] {
  const keep = new Array<boolean>(ops.length).fill(false);
  ops.forEach((op, index) => {
    if (op.type === 'equal') return;
    const from = Math.max(0, index - context);
    const to = Math.min(ops.length - 1, index + context);
    for (let k = from; k <= to; k += 1) keep[k] = true;
  });

  const hunks: DiffOp[][] = [];
  let current: DiffOp[] | null = null;
  ops.forEach((op, index) => {
    if (keep[index]) {
      if (!current) {
        current = [];
        hunks.push(current);
      }
      current.push(op);
    } else {
      current = null;
    }
  });
  return hunks;
}

export function changeSummary(changes: Change[]): { additions: number; deletions: number } {
  return changes.reduce(
    (acc, change) => ({
      additions: acc.additions + change.additions,
      deletions: acc.deletions + change.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}
