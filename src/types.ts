/** Core data model. Everything is plain JSON so a backup is a copy. */

export type FileTree = Record<string, string>;

export type Project = {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  head: string | null;
};

export type Commit = {
  id: string;
  message: string;
  author: string;
  createdAt: number;
  parent: string | null;
  filesChanged: number;
  additions: number;
  deletions: number;
  tree: FileTree;
};

export type ProjectData = {
  files: FileTree;
  commits: Commit[]; // newest first
};

export type ChangeStatus = 'added' | 'modified' | 'deleted';

export type Change = {
  path: string;
  status: ChangeStatus;
  additions: number;
  deletions: number;
  ops: DiffOp[];
};

export type DiffOpType = 'equal' | 'add' | 'del';

export type DiffOp = {
  type: DiffOpType;
  text: string;
  aLine: number | null;
  bLine: number | null;
};

export type ThemeChoice = 'system' | 'light' | 'dark';

export type Settings = {
  theme: ThemeChoice;
  author: string;
  lockEnabled: boolean;
  biometric: boolean;
  salt: string | null;
  hash: string | null;
  autoLockMs: number;
};
