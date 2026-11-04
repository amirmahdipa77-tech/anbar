import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { toHunks } from '../core/diff';
import { mono, space } from '../theme';
import type { Change, DiffOp } from '../types';
import { AppText, Chip, EmptyState, Header, Screen, useTheme } from '../ui/kit';

const CONTEXT = 3;

export function DiffScreen({
  title,
  subtitle,
  changes,
  onBack,
}: {
  title: string;
  subtitle?: string;
  changes: Change[];
  onBack: () => void;
}) {
  const { palette } = useTheme();

  const total = useMemo(
    () =>
      changes.reduce(
        (acc, change) => ({
          additions: acc.additions + change.additions,
          deletions: acc.deletions + change.deletions,
        }),
        { additions: 0, deletions: 0 },
      ),
    [changes],
  );

  return (
    <Screen>
      <Header
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        actions={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label={`+${total.additions}`} tone="success" />
            <Chip label={`−${total.deletions}`} tone="danger" />
          </View>
        }
      />

      {changes.length === 0 ? (
        <EmptyState icon="git-compare-outline" title="No differences" body="These two versions are identical." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
          {changes.map((change) => (
            <View key={change.path}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingHorizontal: space.lg,
                  paddingTop: space.lg,
                  paddingBottom: space.sm,
                }}
              >
                <AppText variant="mono" style={{ flex: 1 }} numberOfLines={1}>
                  {change.path}
                </AppText>
                <Chip
                  label={change.status}
                  tone={change.status === 'added' ? 'success' : change.status === 'deleted' ? 'danger' : 'warn'}
                />
                <AppText variant="caption" faint>
                  +{change.additions} −{change.deletions}
                </AppText>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: palette.surface,
                  paddingLeft: 6,
                }}
              >
                {toHunks(change.ops, CONTEXT).map((hunk, hunkIndex) => (
                  <View key={`${change.path}-${hunkIndex}`}>
                    {hunkIndex > 0 ? (
                      <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
                    ) : null}
                    {hunk.map((op, index) => (
                      <DiffRow key={`${hunkIndex}-${index}`} op={op} />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function DiffRow({ op }: { op: DiffOp }) {
  const { palette } = useTheme();
  const background =
    op.type === 'add' ? withAlpha(palette.success, 0.10) : op.type === 'del' ? withAlpha(palette.danger, 0.10) : 'transparent';
  const sign = op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' ';
  const signColor = op.type === 'add' ? palette.success : op.type === 'del' ? palette.danger : palette.faint;

  return (
    <View style={{ flexDirection: 'row', backgroundColor: background }}>
      <AppText variant="mono" faint style={{ width: 34, textAlign: 'right', paddingVertical: 2 }}>
        {op.aLine ?? ''}
      </AppText>
      <AppText variant="mono" faint style={{ width: 34, textAlign: 'right', paddingVertical: 2 }}>
        {op.bLine ?? ''}
      </AppText>
      <AppText variant="mono" style={{ width: 14, textAlign: 'center', color: signColor, paddingVertical: 2 }}>
        {sign}
      </AppText>
      <AppText
        variant="mono"
        selectable
        style={{ flex: 1, paddingRight: space.md, paddingVertical: 2, color: palette.text, fontFamily: mono }}
      >
        {op.text || ' '}
      </AppText>
    </View>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
