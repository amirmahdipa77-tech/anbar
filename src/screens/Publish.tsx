import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { buildFastImport, publishScript } from '../core/git';
import { bytes as formatBytes, plural, relativeTime } from '../core/format';
import { getProjectData } from '../storage/db';
import { space } from '../theme';
import type { Project } from '../types';
import { AppText, Button, Card, Chip, Header, Screen, Sheet, useTheme, useToast } from '../ui/kit';
import type { ProjectSummary } from './Dashboard';

/**
 * Publish.
 *
 * Anbar has no network permission, so it cannot push for you — and that is the
 * point. What it can do is hand you the whole history as a `git fast-import`
 * stream plus the three commands that turn it into a real repository, so the
 * push itself is one paste away in your own terminal.
 */
export function PublishScreen({ projects }: { projects: ProjectSummary[] }) {
  const { palette } = useTheme();
  const toast = useToast();
  const [target, setTarget] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ commits: number; files: number; bytes: number; stream: string; script: string } | null>(null);

  async function open(project: Project) {
    setBusy(true);
    setTarget(project);
    setInfo(null);
    try {
      const data = await getProjectData(project.id);
      const exported = buildFastImport(project, data);
      setInfo({
        commits: exported.commits,
        files: exported.files,
        bytes: exported.bytes,
        stream: exported.stream,
        script: publishScript(project, exported),
      });
    } finally {
      setBusy(false);
    }
  }

  const total = useMemo(
    () => projects.reduce((acc, entry) => acc + entry.commits, 0),
    [projects],
  );

  return (
    <Screen>
      <Header
        title="Publish"
        subtitle={`${plural(total, 'commit')} ready to export`}
        large
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <LinearGradient
              colors={
                palette.glassTint === 'dark'
                  ? ['rgba(122,162,255,0.16)', 'rgba(122,162,255,0.02)']
                  : ['rgba(44,107,237,0.10)', 'rgba(44,107,237,0.01)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: space.lg }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.accentSoft,
                  }}
                >
                  <Ionicons name="git-branch-outline" size={17} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">History that leaves with you</AppText>
                  <AppText variant="caption" muted style={{ marginTop: 2 }}>
                    Anbar has no network permission. Publishing means exporting a real git repository.
                  </AppText>
                </View>
              </View>
            </LinearGradient>
            <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
            <View style={{ padding: space.lg, gap: 10 }}>
              {[
                ['1', 'Pick a project below.'],
                ['2', 'Copy the fast-import stream and the commands.'],
                ['3', 'Paste both into a terminal — git rebuilds every commit.'],
                ['4', 'git push to your own GitHub repository.'],
              ].map(([step, text]) => (
                <View key={step} style={{ flexDirection: 'row', gap: 10 }}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: palette.surfaceAlt,
                      borderWidth: 1,
                      borderColor: palette.line,
                    }}
                  >
                    <AppText variant="caption" faint style={{ fontSize: 10, fontWeight: '700' }}>
                      {step}
                    </AppText>
                  </View>
                  <AppText variant="caption" muted style={{ flex: 1, lineHeight: 19 }}>
                    {text}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
          <AppText
            variant="caption"
            faint
            style={{ textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: space.sm }}
          >
            Projects
          </AppText>
          {projects.length === 0 ? (
            <Card>
              <AppText variant="body" muted>
                No projects yet. Create one in the Projects tab first.
              </AppText>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {projects.map((entry, index) => (
                <View key={entry.project.id}>
                  {index > 0 ? <View style={{ height: 1, backgroundColor: palette.lineSoft, marginLeft: space.lg }} /> : null}
                  <Pressable
                    onPress={() => void open(entry.project)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}>
                      <Ionicons name="cube-outline" size={17} color={palette.muted} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="body" numberOfLines={1}>
                          {entry.project.name}
                        </AppText>
                        <AppText variant="caption" faint numberOfLines={1} style={{ marginTop: 2 }}>
                          {plural(entry.commits, 'commit')} · {plural(entry.files, 'file')} ·{' '}
                          {relativeTime(entry.project.updatedAt)}
                        </AppText>
                      </View>
                      {entry.commits > 0 ? <Chip label="exportable" tone="accent" /> : <Chip label="empty" />}
                      <Ionicons name="chevron-forward" size={15} color={palette.faint} />
                    </View>
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <Sheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `Publish ${target.name}` : 'Publish'}
        footer={
          <View style={{ gap: space.sm }}>
            <Button
              label="Copy git commands"
              variant="primary"
              icon="terminal-outline"
              disabled={!info}
              onPress={() => {
                if (!info) return;
                void Clipboard.setStringAsync(info.script).then(() =>
                  toast('Commands copied', 'success'),
                );
              }}
            />
            <Button
              label={info ? `Copy fast-import stream (${formatBytes(info.bytes)})` : 'Preparing…'}
              disabled={!info}
              onPress={() => {
                if (!info) return;
                void Clipboard.setStringAsync(info.stream).then(() =>
                  toast('History copied — paste it into anbar.fastimport', 'success'),
                );
              }}
            />
          </View>
        }
      >
        {busy || !info ? (
          <AppText variant="body" muted>
            Reading the history…
          </AppText>
        ) : (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label={plural(info.commits, 'commit')} tone="accent" />
              <Chip label={plural(info.files, 'file')} />
              <Chip label={formatBytes(info.bytes)} />
            </View>
            <View
              style={{
                backgroundColor: palette.surfaceAlt,
                borderWidth: 1,
                borderColor: palette.line,
                borderRadius: 10,
                padding: space.md,
                marginTop: space.sm,
              }}
            >
              <AppText variant="mono" style={{ fontSize: 11.5, lineHeight: 18, color: palette.text }}>
                {info.script}
              </AppText>
            </View>
            <AppText variant="caption" faint>
              Save the stream as anbar.fastimport next to the folder before running the commands.
            </AppText>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
