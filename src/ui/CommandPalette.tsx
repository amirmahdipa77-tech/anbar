import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { plural, relativeTime, shortId } from '../core/format';
import { getProjectData } from '../storage/db';
import { layout, space } from '../theme';
import type { Commit, Project } from '../types';
import { AppText, Divider, Touch, useTheme } from './kit';

export type PaletteAction = {
  id: string;
  label: string;
  detail?: string;
  icon: keyof typeof Ionicons.glyphMap;
  run: () => void;
};

type FileHit = { projectId: string; projectName: string; path: string };
type CommitHit = { projectId: string; projectName: string; commit: Commit };

/**
 * Command palette.
 *
 * One field over everything the app knows: the actions you can run, the files in
 * every project and the commits in every project. It is the fastest way to move
 * around without hunting through three screens.
 */
export function CommandPalette({
  visible,
  onClose,
  projects,
  actions,
  onOpenFile,
  onOpenCommit,
}: {
  visible: boolean;
  onClose: () => void;
  projects: Project[];
  actions: PaletteAction[];
  onOpenFile: (projectId: string, path: string) => void;
  onOpenCommit: (projectId: string, commit: Commit) => void;
}) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<FileHit[]>([]);
  const [commits, setCommits] = useState<CommitHit[]>([]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      const fileHits: FileHit[] = [];
      const commitHits: CommitHit[] = [];
      for (const project of projects) {
        const data = await getProjectData(project.id);
        Object.keys(data.files).forEach((path) =>
          fileHits.push({ projectId: project.id, projectName: project.name, path }),
        );
        data.commits.slice(0, 12).forEach((commit) =>
          commitHits.push({ projectId: project.id, projectName: project.name, commit }),
        );
      }
      if (!alive) return;
      setFiles(fileHits);
      setCommits(commitHits.sort((a, b) => b.commit.createdAt - a.commit.createdAt));
    })();
    return () => {
      alive = false;
    };
  }, [visible, projects]);

  const needle = query.trim().toLowerCase();

  const matchedActions = useMemo(
    () => (needle ? actions.filter((action) => action.label.toLowerCase().includes(needle)) : actions).slice(0, 6),
    [actions, needle],
  );
  const matchedFiles = useMemo(
    () =>
      (needle
        ? files.filter((file) => file.path.toLowerCase().includes(needle) || file.projectName.toLowerCase().includes(needle))
        : files
      ).slice(0, 8),
    [files, needle],
  );
  const matchedCommits = useMemo(
    () =>
      (needle
        ? commits.filter(
            (entry) =>
              entry.commit.message.toLowerCase().includes(needle) ||
              entry.projectName.toLowerCase().includes(needle),
          )
        : commits
      ).slice(0, 6),
    [commits, needle],
  );

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: palette.scrim }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close palette" />
        <View
          style={{
            marginTop: insets.top + 60,
            marginHorizontal: layout.gutter,
            maxHeight: '72%',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: palette.line,
            backgroundColor: palette.surface,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: layout.gutter,
              height: 52,
              borderBottomWidth: 1,
              borderBottomColor: palette.lineSoft,
            }}
          >
            <Ionicons name="search" size={17} color={palette.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Jump to a file, a commit, an action…"
              placeholderTextColor={palette.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, color: palette.text, fontSize: 15, padding: 0, outlineWidth: 0 }}
            />
            <Touch round onPress={onClose} accessibilityLabel="Close" style={{ padding: 6 }}>
              <Ionicons name="close" size={17} color={palette.faint} />
            </Touch>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 6 }}>
            {matchedActions.length > 0 ? (
              <Group label="Actions">
                {matchedActions.map((action) => (
                  <PaletteRow
                    key={action.id}
                    icon={action.icon}
                    title={action.label}
                    detail={action.detail}
                    onPress={() => {
                      onClose();
                      action.run();
                    }}
                  />
                ))}
              </Group>
            ) : null}

            {matchedFiles.length > 0 ? (
              <Group label={`Files · ${plural(matchedFiles.length, 'match')}`}>
                {matchedFiles.map((file) => (
                  <PaletteRow
                    key={`${file.projectId}:${file.path}`}
                    icon="document-text-outline"
                    title={file.path}
                    detail={file.projectName}
                    mono
                    onPress={() => {
                      onClose();
                      onOpenFile(file.projectId, file.path);
                    }}
                  />
                ))}
              </Group>
            ) : null}

            {matchedCommits.length > 0 ? (
              <Group label="Commits">
                {matchedCommits.map((entry) => (
                  <PaletteRow
                    key={entry.commit.id}
                    icon="git-commit-outline"
                    title={entry.commit.message}
                    detail={`${entry.projectName} · ${shortId(entry.commit.id)} · ${relativeTime(
                      entry.commit.createdAt,
                    )}`}
                    onPress={() => {
                      onClose();
                      onOpenCommit(entry.projectId, entry.commit);
                    }}
                  />
                ))}
              </Group>
            ) : null}

            {!matchedActions.length && !matchedFiles.length && !matchedCommits.length ? (
              <View style={{ padding: layout.gutter, alignItems: 'center' }}>
                <AppText variant="body" muted>
                  Nothing matches “{query}”.
                </AppText>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingTop: 6 }}>
      <AppText
        variant="caption"
        faint
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          paddingHorizontal: layout.gutter,
          paddingBottom: 4,
        }}
      >
        {label}
      </AppText>
      {children}
    </View>
  );
}

function PaletteRow({
  icon,
  title,
  detail,
  onPress,
  mono,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string;
  onPress: () => void;
  mono?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <>
      <Touch onPress={onPress} style={{ paddingHorizontal: layout.gutter }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, height: layout.rowHeight }}>
          <Ionicons name={icon} size={16} color={palette.muted} />
          <AppText
            variant={mono ? 'mono' : 'body'}
            numberOfLines={1}
            style={{ flex: 1, color: palette.text }}
          >
            {title}
          </AppText>
          {detail ? (
            <AppText variant="caption" faint numberOfLines={1} style={{ maxWidth: '45%' }}>
              {detail}
            </AppText>
          ) : null}
        </View>
      </Touch>
      <Divider inset={layout.gutter} />
    </>
  );
}
