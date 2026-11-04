import type { Commit, Project, ProjectData } from '../types';

/**
 * Git export.
 *
 * Anbar never touches the network, so "publish" means: hand you a
 * `git fast-import` stream that recreates the whole history — every commit, its
 * message, its author and its timestamp — as a real git repository. One shell
 * snippet imports it, and from there a normal `git push` is all it takes.
 */

function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // surrogate pair
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function quotePath(path: string): string {
  return /^[A-Za-z0-9._\-/]+$/.test(path) ? path : `"${path.replace(/"/g, '\\"')}"`;
}

function identity(name: string, email: string, timestamp: number): string {
  return `${name} <${email}> ${Math.floor(timestamp / 1000)} +0000`;
}

function emailFor(author: string): string {
  const slug = author
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${slug || 'anbar'}@anbar.local`;
}

export type GitExport = {
  branch: string;
  stream: string;
  commits: number;
  files: number;
  bytes: number;
};

/** Build a fast-import stream that recreates the project's full history. */
export function buildFastImport(project: Project, data: ProjectData): GitExport {
  const branch = 'main';
  const ordered = [...data.commits].sort((a, b) => a.createdAt - b.createdAt);
  const lines: string[] = [];
  const marks = new Map<string, number>();
  let mark = 0;

  ordered.forEach((commit) => {
    mark += 1;
    marks.set(commit.id, mark);
    const author = commit.author || project.author || 'You';
    const email = emailFor(author);
    const message = `${commit.message}\n`;

    lines.push(`commit refs/heads/${branch}`);
    lines.push(`mark :${mark}`);
    lines.push(`author ${identity(author, email, commit.createdAt)}`);
    lines.push(`committer ${identity(author, email, commit.createdAt)}`);
    lines.push(`data ${utf8Length(message)}`);
    lines.push(message.replace(/\n$/, ''));
    if (commit.parent && marks.has(commit.parent)) {
      lines.push(`from :${marks.get(commit.parent)}`);
    }
    lines.push('deleteall');
    Object.keys(commit.tree)
      .sort()
      .forEach((path) => {
        const content = commit.tree[path];
        lines.push(`M 100644 inline ${quotePath(path)}`);
        lines.push(`data ${utf8Length(content)}`);
        lines.push(content);
      });
    lines.push('');
  });

  lines.push('done');
  const stream = lines.join('\n');
  return {
    branch,
    stream,
    commits: ordered.length,
    files: Object.keys(data.files).length,
    bytes: utf8Length(stream),
  };
}

/** The shell commands that turn the stream into a repository and push it. */
export function publishScript(project: Project, exportInfo: GitExport, remote?: string): string {
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
  const url = remote && remote.trim() ? remote.trim() : `https://github.com/<you>/${slug}.git`;

  return [
    '# 1. write the history next to a new folder',
    `mkdir -p ${slug} && cd ${slug}`,
    'git init -q',
    '',
    '# 2. import every commit from Anbar',
    'git fast-import --quiet < ../anbar.fastimport',
    `git checkout -q -B ${exportInfo.branch}`,
    '',
    '# 3. push it to GitHub',
    `git remote add origin ${url}`,
    `git push -u origin ${exportInfo.branch}`,
    '',
    `# ${exportInfo.commits} commits, ${exportInfo.files} files`,
  ].join('\n');
}

export function summarize(commits: Commit[]): { first: number | null; last: number | null } {
  if (!commits.length) return { first: null, last: null };
  const times = commits.map((commit) => commit.createdAt);
  return { first: Math.min(...times), last: Math.max(...times) };
}
