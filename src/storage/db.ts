import AsyncStorage from '@react-native-async-storage/async-storage';
import { diffTrees, changeSummary } from '../core/diff';
import { newId } from '../core/ids';
import type { Change, Commit, Project, ProjectData } from '../types';

/**
 * Storage.
 *
 * One key holds the project index, one key holds a project's whole world
 * (working tree + every commit snapshot). Writes are serialised through a small
 * promise queue so two taps can never interleave a read-modify-write and lose
 * data. Nothing here talks to a network: the app ships without the INTERNET
 * permission on Android, so it *cannot*.
 */

const INDEX_KEY = 'anbar:v2:index';
const projectKey = (id: string) => `anbar:v2:project:${id}`;

let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readIndex(): Promise<Project[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(list: Project[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

async function readProject(id: string): Promise<ProjectData> {
  const raw = await AsyncStorage.getItem(projectKey(id));
  if (!raw) return { files: {}, commits: [] };
  try {
    const parsed = JSON.parse(raw) as ProjectData;
    return {
      files: parsed.files ?? {},
      commits: Array.isArray(parsed.commits) ? parsed.commits : [],
    };
  } catch {
    return { files: {}, commits: [] };
  }
}

async function writeProject(id: string, data: ProjectData): Promise<void> {
  await AsyncStorage.setItem(projectKey(id), JSON.stringify(data));
}

export function headCommit(data: ProjectData): Commit | null {
  return data.commits.length ? data.commits[0] : null;
}

export function emptyTree(): Record<string, string> {
  return {};
}

/* ------------------------------------------------------------------ projects */

export function listProjects(): Promise<Project[]> {
  return serialise(async () => {
    const list = await readIndex();
    return list.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  });
}

export function getProject(id: string): Promise<Project | null> {
  return serialise(async () => {
    const list = await readIndex();
    return list.find((item) => item.id === id) ?? null;
  });
}

export function getProjectData(id: string): Promise<ProjectData> {
  return serialise(() => readProject(id));
}

export function createProject(input: {
  name: string;
  description?: string;
  author?: string;
}): Promise<Project> {
  return serialise(async () => {
    const name = input.name.trim();
    if (!name) throw new Error('Give the project a name.');
    const list = await readIndex();
    if (list.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`A project called “${name}” already exists.`);
    }
    const now = Date.now();
    const project: Project = {
      id: newId(),
      name,
      description: (input.description ?? '').trim(),
      author: (input.author ?? 'You').trim() || 'You',
      createdAt: now,
      updatedAt: now,
      head: null,
    };
    await writeIndex([project, ...list]);
    await writeProject(project.id, { files: {}, commits: [] });
    return project;
  });
}

export function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  return serialise(async () => {
    const list = await readIndex();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('Project not found.');
    const next: Project = { ...list[index], ...patch, updatedAt: Date.now() };
    list[index] = next;
    await writeIndex(list);
    return next;
  });
}

export function deleteProject(id: string): Promise<void> {
  return serialise(async () => {
    const list = await readIndex();
    await writeIndex(list.filter((item) => item.id !== id));
    await AsyncStorage.removeItem(projectKey(id));
  });
}

/* --------------------------------------------------------------------- files */

export function writeFile(id: string, path: string, content: string): Promise<void> {
  return serialise(async () => {
    const clean = path.trim().replace(/^\/+/, '');
    if (!clean) throw new Error('A file needs a path.');
    if (clean.includes('..')) throw new Error('Paths cannot contain “..”.');
    const data = await readProject(id);
    data.files[clean] = content;
    await writeProject(id, data);
    await touch(id);
  });
}

export function deleteFile(id: string, path: string): Promise<void> {
  return serialise(async () => {
    const data = await readProject(id);
    delete data.files[path];
    await writeProject(id, data);
    await touch(id);
  });
}

export function renameFile(id: string, from: string, to: string): Promise<void> {
  return serialise(async () => {
    const clean = to.trim().replace(/^\/+/, '');
    if (!clean) throw new Error('A file needs a path.');
    const data = await readProject(id);
    if (!(from in data.files)) throw new Error('File not found.');
    if (clean !== from && clean in data.files) throw new Error('That path is already taken.');
    const content = data.files[from];
    delete data.files[from];
    data.files[clean] = content;
    await writeProject(id, data);
    await touch(id);
  });
}

async function touch(id: string): Promise<void> {
  const list = await readIndex();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return;
  list[index] = { ...list[index], updatedAt: Date.now() };
  await writeIndex(list);
}

/* ------------------------------------------------------------------- changes */

export async function workingChanges(id: string): Promise<Change[]> {
  const data = await readProject(id);
  const head = headCommit(data);
  return diffTrees(head ? head.tree : emptyTree(), data.files);
}

export async function commitDiff(id: string, commitId: string): Promise<Change[]> {
  const data = await readProject(id);
  const index = data.commits.findIndex((item) => item.id === commitId);
  if (index === -1) return [];
  const commit = data.commits[index];
  const parent = commit.parent ? data.commits.find((item) => item.id === commit.parent) : null;
  return diffTrees(parent ? parent.tree : emptyTree(), commit.tree);
}

/* ------------------------------------------------------------------- commits */

export function commit(id: string, message: string, author?: string): Promise<Commit> {
  return serialise(async () => {
    const list = await readIndex();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('Project not found.');
    const project = list[index];
    const data = await readProject(id);
    if (Object.keys(data.files).length === 0) {
      throw new Error('This project has no files yet.');
    }
    const parent = headCommit(data);
    const changes = diffTrees(parent ? parent.tree : emptyTree(), data.files);
    if (parent && changes.length === 0) {
      throw new Error('Nothing to commit — the working tree matches the last commit.');
    }
    const { additions, deletions } = changeSummary(changes);
    const record: Commit = {
      id: newId(),
      message: message.trim() || 'Update files',
      author: (author ?? project.author ?? 'You').trim() || 'You',
      createdAt: Date.now(),
      parent: parent ? parent.id : null,
      filesChanged: changes.length,
      additions,
      deletions,
      tree: { ...data.files },
    };
    data.commits = [record, ...data.commits];
    await writeProject(id, data);

    list[index] = {
      ...project,
      head: record.id,
      updatedAt: record.createdAt,
      author: record.author,
    };
    await writeIndex(list);
    return record;
  });
}

export function restoreCommit(id: string, commitId: string): Promise<void> {
  return serialise(async () => {
    const data = await readProject(id);
    const commitRecord = data.commits.find((item) => item.id === commitId);
    if (!commitRecord) throw new Error('Commit not found.');
    data.files = { ...commitRecord.tree };
    await writeProject(id, data);
    await touch(id);
  });
}

/* ---------------------------------------------------------- import / export */

export async function exportBackup(): Promise<string> {
  const list = await readIndex();
  const payload = {
    app: 'anbar',
    version: 2,
    exportedAt: new Date().toISOString(),
    projects: [] as Array<{ project: Project; data: ProjectData }>,
  };
  for (const project of list) {
    payload.projects.push({ project, data: await readProject(project.id) });
  }
  return JSON.stringify(payload, null, 2);
}

export function importBackup(raw: string): Promise<number> {
  return serialise(async () => {
    let payload: { app?: string; projects?: Array<{ project: Project; data: ProjectData }> };
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error('That is not valid JSON.');
    }
    if (!payload || payload.app !== 'anbar' || !Array.isArray(payload.projects)) {
      throw new Error('That file is not an Anbar backup.');
    }
    const list = await readIndex();
    let imported = 0;
    for (const entry of payload.projects) {
      if (!entry?.project?.id) continue;
      const project: Project = {
        ...entry.project,
        updatedAt: entry.project.updatedAt ?? Date.now(),
      };
      await writeProject(project.id, {
        files: entry.data?.files ?? {},
        commits: Array.isArray(entry.data?.commits) ? entry.data.commits : [],
      });
      const existing = list.findIndex((item) => item.id === project.id);
      if (existing === -1) list.unshift(project);
      else list[existing] = project;
      imported += 1;
    }
    await writeIndex(list);
    return imported;
  });
}

/* --------------------------------------------------------------------- demo */

export function seedDemo(author = 'You'): Promise<Project> {
  return serialise(async () => {
    const list = await readIndex();
    const existing = list.find((item) => item.name === 'anbar-demo');
    if (existing) return existing;

    const now = Date.now();
    const project: Project = {
      id: newId(),
      name: 'anbar-demo',
      description: 'A small project to poke at: edit a file, commit it, read the diff.',
      author,
      createdAt: now,
      updatedAt: now,
      head: null,
    };

    const files: Record<string, string> = {
      'README.md':
        '# Anbar demo\n\n1. Open `src/greeting.ts`\n2. Change the text\n3. Commit from the header\n4. Open History and read the diff\n',
      'src/greeting.ts':
        "export function greeting(name: string): string {\n  return `Hello, ${name}.`;\n}\n\nexport function farewell(name: string): string {\n  return `Goodbye, ${name}.`;\n}\n",
      'src/theme.ts':
        "export const tokens = {\n  accent: '#2C6BED',\n  radius: 14,\n  hairline: '#E6E6EA',\n};\n",
      'notes.txt': 'Ideas\n- pin a project to the top\n- export a single file\n- search inside files\n',
    };

    await writeProject(project.id, { files, commits: [] });
    await writeIndex([project, ...list]);

    const firstChanges = diffTrees({}, files);
    const { additions, deletions } = changeSummary(firstChanges);
    const first: Commit = {
      id: newId(),
      message: 'Initial commit: demo project',
      author,
      createdAt: now,
      parent: null,
      filesChanged: firstChanges.length,
      additions,
      deletions,
      tree: { ...files },
    };
    await writeProject(project.id, { files, commits: [first] });
    await writeIndex([{ ...project, head: first.id }, ...list]);
    return { ...project, head: first.id };
  });
}
