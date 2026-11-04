import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { commitDiff } from '../storage/db';
import { dateTime, plural, shortId } from '../core/format';
import { mono, space } from '../theme';
import type { Change, Commit } from '../types';
import {
  AppText,
  Button,
  Card,
  Chip,
  Divider,
  Header,
  Row,
  Screen,
  Sheet,
  useTheme,
} from '../ui/kit';

export function CommitDetailScreen({
  projectId,
  commit,
  onBack,
  onRestore,
  onViewSnapshot,
}: {
  projectId: string;
  commit: Commit;
  onBack: () => void;
  onRestore: () => Promise<void>;
  onViewSnapshot: (path: string, content: string) => void;
}) {
  const { palette } = useTheme();
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void commitDiff(projectId, commit.id).then((result) => {
      if (alive) setChanges(result);
    });
    return () => {
      alive = false;
    };
  }, [commit.id, projectId]);

  const files = Object.keys(commit.tree).sort((a, b) => a.localeCompare(b));

  return (
    <Screen>
      <Header title={commit.message} subtitle={`${shortId(commit.id)} · ${dateTime(commit.createdAt)}`} onBack={onBack} />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ padding: space.lg }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', gap: space.lg, padding: space.lg }}>
              <Metric label="Files" value={String(commit.filesChanged)} />
              <Metric label="Added" value={`+${commit.additions}`} tone={palette.success} />
              <Metric label="Removed" value={`−${commit.deletions}`} tone={palette.danger} />
            </View>
            <Divider />
            <View style={{ padding: space.lg }}>
              <AppText variant="caption" faint>
                {commit.author} · {commit.parent ? `parent ${shortId(commit.parent)}` : 'first commit'}
              </AppText>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button label="Browse files" icon="documents-outline" onPress={() => setBrowsing(true)} />
            <Button label="Restore" variant="primary" icon="time-outline" onPress={() => setConfirming(true)} />
          </View>

          <AppText variant="caption" faint style={{ marginTop: space.xxl, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 0.7 }}>
            Changed in this commit
          </AppText>

          {changes === null ? (
            <AppText variant="body" muted>
              Loading…
            </AppText>
          ) : changes.length === 0 ? (
            <AppText variant="body" muted>
              This commit changed no files.
            </AppText>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {changes.map((change, index) => (
                <View key={change.path}>
                  {index > 0 ? <Divider inset={space.lg} /> : null}
                  <Row
                    mono
                    title={change.path}
                    meta={`+${change.additions} −${change.deletions}`}
                    left={
                      <Chip
                        label={change.status.slice(0, 1).toUpperCase()}
                        tone={change.status === 'added' ? 'success' : change.status === 'deleted' ? 'danger' : 'warn'}
                      />
                    }
                    onPress={() => onViewSnapshot(change.path, commit.tree[change.path] ?? '')}
                  />
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <Sheet visible={browsing} onClose={() => setBrowsing(false)} title={`Files at ${shortId(commit.id)}`}>
        <AppText variant="caption" faint style={{ marginBottom: space.sm }}>
          {plural(files.length, 'file')} in this snapshot. Read-only.
        </AppText>
        {files.map((path) => (
          <Pressable
            key={path}
            onPress={() => {
              setBrowsing(false);
              onViewSnapshot(path, commit.tree[path]);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 11 }}>
              <Ionicons name="document-text-outline" size={16} color={palette.muted} />
              <AppText variant="mono" style={{ flex: 1 }} numberOfLines={1}>
                {path}
              </AppText>
              <AppText variant="caption" faint>
                {commit.tree[path].split('\n').length} lines
              </AppText>
            </View>
          </Pressable>
        ))}
      </Sheet>

      <Sheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Restore this version?"
        footer={
          <Button
            label={busy ? 'Restoring…' : 'Restore files'}
            variant="primary"
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void onRestore().finally(() => {
                setBusy(false);
                setConfirming(false);
              });
            }}
          />
        }
      >
        <AppText variant="body" muted style={{ lineHeight: 21 }}>
          Every file goes back to how it looked in {shortId(commit.id)}. Nothing is committed for you — the
          restored files show up as pending changes, so you can review them first.
        </AppText>
      </Sheet>
    </Screen>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="caption" faint>
        {label}
      </AppText>
      <AppText variant="title" style={{ marginTop: 2, color: tone ?? palette.text, fontFamily: mono, fontSize: 19 }}>
        {value}
      </AppText>
    </View>
  );
}
