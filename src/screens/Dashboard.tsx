import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { plural, relativeTime } from '../core/format';
import { space } from '../theme';
import type { Project } from '../types';
import {
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  Header,
  IconButton,
  Row,
  Screen,
  Sheet,
  useTheme,
} from '../ui/kit';

export type ProjectSummary = {
  project: Project;
  files: number;
  commits: number;
  lastMessage: string | null;
};

export function DashboardScreen({
  projects,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onSeed,
  onSettings,
  locked,
  navPadding,
}: {
  projects: ProjectSummary[];
  onOpen: (project: Project) => void;
  onCreate: (input: { name: string; description: string }) => Promise<void>;
  onRename: (project: Project, input: { name: string; description: string }) => Promise<void>;
  onDelete: (project: Project) => Promise<void>;
  onSeed: () => Promise<void>;
  onSettings: () => void;
  locked: boolean;
  navPadding: number;
}) {
  const { palette } = useTheme();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [menu, setMenu] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(
      (entry) =>
        entry.project.name.toLowerCase().includes(needle) ||
        entry.project.description.toLowerCase().includes(needle),
    );
  }, [projects, query]);

  const totals = useMemo(
    () =>
      projects.reduce(
        (acc, entry) => ({
          files: acc.files + entry.files,
          commits: acc.commits + entry.commits,
        }),
        { files: 0, commits: 0 },
      ),
    [projects],
  );

  function openCreate() {
    setName('');
    setDescription('');
    setError(null);
    setCreating(true);
  }

  function openEdit(project: Project) {
    setName(project.name);
    setDescription(project.description);
    setError(null);
    setEditing(project);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (editing) await onRename(editing, { name, description });
      else await onCreate({ name, description });
      setCreating(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header
        title="Projects"
        subtitle={`${plural(projects.length, 'project')} · ${plural(totals.commits, 'commit')} · offline`}
        large
        actions={
          <>
            {locked ? <IconButton name="lock-closed" onPress={onSettings} accessibilityLabel="App lock" /> : null}
            <IconButton name="add" onPress={openCreate} accessibilityLabel="New project" size={22} />
          </>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.project.id}
        contentContainerStyle={{ paddingBottom: navPadding + 24 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.line,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 12,
                height: 40,
              }}
            >
              <Ionicons name="search" size={16} color={palette.faint} />
              <FieldSearch value={query} onChange={setQuery} />
            </View>
          </View>
        }
        ListEmptyComponent={
          query ? (
            <EmptyState
              icon="search"
              title="Nothing matches"
              body="Try a different word, or clear the search."
            />
          ) : (
            <EmptyState
              icon="albums-outline"
              title="Start your first project"
              body="A project keeps your files, your commits and their history on this device — and nowhere else."
              action={
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="New project" variant="primary" icon="add" onPress={openCreate} />
                  <Button label="Load demo" onPress={() => void onSeed()} />
                </View>
              }
            />
          )
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: space.lg }}>
            <Card style={{ marginBottom: space.sm, padding: 0, overflow: 'hidden' }}>
              <Pressable
                onPress={() => onOpen(item.project)}
                onLongPress={() => setMenu(item.project)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: palette.accentSoft,
                    }}
                  >
                    <Ionicons name="folder-outline" size={17} color={palette.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="heading" numberOfLines={1}>
                      {item.project.name}
                    </AppText>
                    <AppText variant="caption" muted numberOfLines={1} style={{ marginTop: 3 }}>
                      {plural(item.files, 'file')} · {plural(item.commits, 'commit')} ·{' '}
                      {relativeTime(item.project.updatedAt)}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={palette.faint} />
                </View>
                {item.project.description ? (
                  <>
                    <Divider />
                    <View style={{ paddingHorizontal: space.lg, paddingVertical: 10 }}>
                      <AppText variant="caption" muted numberOfLines={1}>
                        {item.project.description}
                      </AppText>
                    </View>
                  </>
                ) : null}
              </Pressable>
            </Card>
          </View>
        )}
      />


      <Sheet
        visible={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Rename project' : 'New project'}
        footer={
          <Button
            label={editing ? 'Save changes' : 'Create project'}
            variant="primary"
            onPress={() => void submit()}
            disabled={busy || name.trim().length === 0}
          />
        }
      >
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="my-first-app"
          autoCapitalize="none"
          autoCorrect={false}
          error={error ?? undefined}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What is this project about?"
        />
      </Sheet>

      <Sheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.name ?? ''}>
        <Row
          title="Rename or describe"
          left={<Ionicons name="create-outline" size={18} color={palette.muted} />}
          onPress={() => {
            if (menu) openEdit(menu);
            setMenu(null);
          }}
        />
        <Row
          title="Delete project"
          subtitle="Removes every file and commit on this device"
          left={<Ionicons name="trash-outline" size={18} color={palette.danger} />}
          onPress={() => {
            const target = menu;
            setMenu(null);
            if (target) void onDelete(target);
          }}
        />
      </Sheet>
    </Screen>
  );
}

function FieldSearch({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { palette } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Search projects"
      placeholderTextColor={palette.faint}
      style={{ flex: 1, color: palette.text, fontSize: 15, padding: 0 }}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
    />
  );
}
