import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { plural, relativeTime, shortId } from '../core/format';
import { diffTrees } from '../core/diff';
import { space } from '../theme';
import type { Change, Commit, Project, ProjectData } from '../types';
import {
  AppText,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Field,
  Header,
  IconButton,
  Row,
  Screen,
  Segmented,
  Sheet,
  useTheme,
} from '../ui/kit';

type Tab = 'files' | 'changes' | 'history';

export function WorkspaceScreen({
  project,
  data,
  changes,
  onBack,
  onOpenFile,
  onCreateFile,
  onDeleteFile,
  onCommit,
  onOpenChange,
  onOpenCommit,
  onFind,
  onSettings,
  onCompare,
}: {
  project: Project;
  data: ProjectData;
  changes: Change[];
  onBack: () => void;
  onOpenFile: (path: string) => void;
  onCreateFile: (path: string) => Promise<void>;
  onDeleteFile: (path: string) => Promise<void>;
  onCommit: (message: string) => Promise<void>;
  onOpenChange: (change: Change) => void;
  onOpenCommit: (commit: Commit) => void;
  onFind: () => void;
  onSettings: () => void;
  onCompare: (title: string, changes: Change[]) => void;
}) {
  const { palette } = useTheme();
  const [tab, setTab] = useState<Tab>('files');
  const [creating, setCreating] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [path, setPath] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const files = useMemo(
    () => Object.keys(data.files).sort((a, b) => a.localeCompare(b)),
    [data.files],
  );

  const folders = useMemo(() => {
    const map = new Map<string, string[]>();
    files.forEach((file) => {
      const parts = file.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const bucket = map.get(folder) ?? [];
      bucket.push(file);
      map.set(folder, bucket);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  async function submitCreate() {
    setBusy(true);
    setError(null);
    try {
      await onCreateFile(path);
      setCreating(false);
      setPath('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the file.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCommit() {
    setBusy(true);
    setError(null);
    try {
      await onCommit(message);
      setCommitting(false);
      setMessage('');
      setTab('history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not commit.');
    } finally {
      setBusy(false);
    }
  }

  const head = data.commits[0] ?? null;

  return (
    <Screen>
      <Header
        title={project.name}
        subtitle={`${plural(files.length, 'file')} · ${plural(data.commits.length, 'commit')} · ${
          head ? `head ${shortId(head.id)}` : 'no commits yet'
        }`}
        onBack={onBack}
        actions={
          <>
            <IconButton name="search" onPress={onFind} accessibilityLabel="Find in files" />
            <IconButton name="settings-outline" onPress={onSettings} accessibilityLabel="Settings" />
          </>
        }
      />

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'files', label: 'Files' },
            { value: 'changes', label: 'Changes', badge: changes.length || undefined },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>

      {tab === 'files' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
            {files.length === 0 ? (
              <EmptyState
                icon="document-outline"
                title="No files yet"
                body="Create a file to start. Use a slash in the name — src/app.ts — to make folders."
                action={
                  <Button label="New file" variant="primary" icon="add" onPress={() => setCreating(true)} />
                }
              />
            ) : (
              folders.map(([folder, bucket]) => (
                <View key={folder || '/'} style={{ marginBottom: space.md }}>
                  {folder ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="folder-outline" size={13} color={palette.faint} />
                      <AppText variant="caption" faint>
                        {folder}
                      </AppText>
                    </View>
                  ) : null}
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {bucket.map((file, index) => {
                      const changed = changes.some((change) => change.path === file);
                      const name = file.split('/').pop() ?? file;
                      return (
                        <View key={file}>
                          {index > 0 ? <Divider inset={space.lg} /> : null}
                          <Pressable
                            onPress={() => onOpenFile(file)}
                            onLongPress={() => void onDeleteFile(file)}
                            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: space.md,
                                paddingHorizontal: space.lg,
                                paddingVertical: 13,
                              }}
                            >
                              <AppText variant="mono" faint style={{ width: 26 }}>
                                {extensionTag(name)}
                              </AppText>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <AppText variant="body" numberOfLines={1}>
                                  {name}
                                </AppText>
                                <AppText variant="caption" faint numberOfLines={1} style={{ marginTop: 2 }}>
                                  {data.files[file].split('\n').length} lines
                                </AppText>
                              </View>
                              {changed ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.warn }} /> : null}
                              <Ionicons name="chevron-forward" size={15} color={palette.faint} />
                            </View>
                          </Pressable>
                        </View>
                      );
                    })}
                  </Card>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : null}

      {tab === 'changes' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
            {changes.length === 0 ? (
              <EmptyState
                icon="checkmark-circle-outline"
                title="Working tree clean"
                body="Every file matches the last commit. Edit something and it will appear here."
              />
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {changes.map((change, index) => (
                  <View key={change.path}>
                    {index > 0 ? <Divider inset={space.lg} /> : null}
                    <Row
                      mono
                      title={change.path}
                      onPress={() => onOpenChange(change)}
                      left={<StatusDot status={change.status} />}
                      meta={`+${change.additions} −${change.deletions}`}
                      right={<Ionicons name="chevron-forward" size={15} color={palette.faint} />}
                    />
                  </View>
                ))}
              </Card>
            )}
          </View>
        </ScrollView>
      ) : null}

      {tab === 'history' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
            {data.commits.length === 0 ? (
              <EmptyState
                icon="git-commit-outline"
                title="No commits yet"
                body="Commit once and every file gets a snapshot you can come back to."
                action={
                  <Button
                    label="Commit changes"
                    variant="primary"
                    icon="checkmark"
                    disabled={changes.length === 0}
                    onPress={() => setCommitting(true)}
                  />
                }
              />
            ) : (
              <>
              <Pressable
                onPress={() => {
                  setBaseId(null);
                  setCompareOpen(true);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  marginBottom: space.sm,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: palette.surfaceAlt,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="git-compare-outline" size={16} color={palette.accent} />
                <AppText variant="label" style={{ color: palette.accent, flex: 1 }}>
                  Compare two commits
                </AppText>
                <Ionicons name="chevron-forward" size={14} color={palette.faint} />
              </Pressable>
              {data.commits.map((commit, index) => (
                <Card key={commit.id} style={{ marginBottom: space.sm, padding: 0, overflow: 'hidden' }}>
                  <Pressable
                    onPress={() => onOpenCommit(commit)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ padding: space.lg }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <AppText variant="mono" faint>
                          {shortId(commit.id)}
                        </AppText>
                        <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                          {commit.message}
                        </AppText>
                        {index === 0 ? <Chip label="HEAD" tone="accent" /> : null}
                      </View>
                      <AppText variant="caption" muted style={{ marginTop: 6 }}>
                        {commit.author} · {relativeTime(commit.createdAt)} ·{' '}
                        {plural(commit.filesChanged, 'file')}
                      </AppText>
                      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 8 }}>
                        <Chip label={`+${commit.additions}`} tone="success" />
                        <Chip label={`−${commit.deletions}`} tone="danger" />
                      </View>
                    </View>
                  </Pressable>
                </Card>
              ))}
              </>
            )}
          </View>
        </ScrollView>
      ) : null}

      {tab === 'files' && files.length > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: space.lg,
            right: space.lg,
            bottom: space.xl,
            gap: space.sm,
          }}
        >
          {changes.length > 0 ? (
            <Button
              label={`Commit ${plural(changes.length, 'file')}`}
              variant="primary"
              icon="checkmark"
              onPress={() => setCommitting(true)}
            />
          ) : (
            <Button label="New file" variant="primary" icon="add" onPress={() => setCreating(true)} />
          )}
        </View>
      ) : null}

      <Sheet
        visible={creating}
        onClose={() => setCreating(false)}
        title="New file"
        footer={
          <Button
            label="Create file"
            variant="primary"
            disabled={busy || path.trim().length === 0}
            onPress={() => void submitCreate()}
          />
        }
      >
        <Field
          label="Path"
          value={path}
          onChangeText={setPath}
          placeholder="src/app.ts"
          autoCapitalize="none"
          autoCorrect={false}
          error={error ?? undefined}
          hint="A slash creates a folder."
        />
      </Sheet>

      <Sheet
        visible={compareOpen}
        onClose={() => setCompareOpen(false)}
        title={baseId ? 'Pick the newer commit' : 'Pick the older commit'}
      >
        <AppText variant="caption" faint style={{ marginBottom: space.sm }}>
          {baseId ? 'The diff will run from the first pick to this one.' : 'This is the “before” side.'}
        </AppText>
        {data.commits.map((commit) => (
          <Row
            key={commit.id}
            title={commit.message}
            subtitle={`${shortId(commit.id)} · ${relativeTime(commit.createdAt)}`}
            selected={commit.id === baseId}
            onPress={() => {
              if (!baseId) {
                setBaseId(commit.id);
                return;
              }
              const from = data.commits.find((item) => item.id === baseId);
              const to = commit;
              setCompareOpen(false);
              if (!from || from.id === to.id) return;
              onCompare(
                `${shortId(from.id)} → ${shortId(to.id)}`,
                diffTrees(from.tree, to.tree),
              );
            }}
            right={<Ionicons name="chevron-forward" size={14} color={palette.faint} />}
          />
        ))}
      </Sheet>

      <Sheet
        visible={committing}
        onClose={() => setCommitting(false)}
        title={`Commit ${plural(changes.length, 'file')}`}
        footer={
          <Button
            label="Commit"
            variant="primary"
            disabled={busy || message.trim().length === 0}
            onPress={() => void submitCommit()}
          />
        }
      >
        <Field
          label="Message"
          value={message}
          onChangeText={setMessage}
          placeholder="Fix the greeting text"
          error={error ?? undefined}
          multiline
        />
        <AppText variant="caption" faint>
          A snapshot of all {files.length} files is stored with this commit.
        </AppText>
      </Sheet>
    </Screen>
  );
}

function StatusDot({ status }: { status: Change['status'] }) {
  const { palette } = useTheme();
  const color =
    status === 'added' ? palette.success : status === 'deleted' ? palette.danger : palette.warn;
  const letter = status === 'added' ? 'A' : status === 'deleted' ? 'D' : 'M';
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}1A`,
      }}
    >
      <AppText variant="caption" style={{ color, fontWeight: '700', fontSize: 11 }}>
        {letter}
      </AppText>
    </View>
  );
}

function extensionTag(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name);
  if (!match) return '··';
  const ext = match[1].toUpperCase();
  if (ext === 'JSON') return 'JS';
  return ext.slice(0, 3);
}
