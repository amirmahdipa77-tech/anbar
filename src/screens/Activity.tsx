import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { plural, relativeTime, shortId } from '../core/format';
import { space } from '../theme';
import type { ActivityEntry } from '../storage/db';
import { AppText, Card, Chip, EmptyState, Header, Screen, useTheme } from '../ui/kit';

export function ActivityScreen({
  entries,
  onOpen,
}: {
  entries: ActivityEntry[];
  onOpen: (entry: ActivityEntry) => void;
}) {
  const { palette } = useTheme();
  const days = groupByDay(entries);

  return (
    <Screen>
      <Header
        title="Activity"
        subtitle={`${plural(entries.length, 'commit')} across every project`}
        large
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {entries.length === 0 ? (
          <EmptyState
            icon="pulse-outline"
            title="Nothing yet"
            body="Commit something in a project and it appears here, newest first."
          />
        ) : (
          days.map((group) => (
            <View key={group.label} style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
              <AppText
                variant="caption"
                faint
                style={{ textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: space.sm }}
              >
                {group.label}
              </AppText>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {group.entries.map((entry, index) => (
                  <View key={entry.commit.id}>
                    {index > 0 ? (
                      <View style={{ height: 1, backgroundColor: palette.lineSoft, marginLeft: space.lg }} />
                    ) : null}
                    <Pressable
                      onPress={() => onOpen(entry)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <View style={{ flexDirection: 'row', gap: space.md, padding: space.lg }}>
                        <View style={{ width: 3, borderRadius: 2, backgroundColor: palette.accent, opacity: 0.45 }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <AppText variant="body" numberOfLines={1} style={{ fontWeight: '500' }}>
                            {entry.commit.message}
                          </AppText>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                            <Ionicons name="folder-outline" size={11} color={palette.faint} />
                            <AppText variant="caption" faint numberOfLines={1}>
                              {entry.project.name} · {shortId(entry.commit.id)} ·{' '}
                              {relativeTime(entry.commit.createdAt)}
                            </AppText>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Chip label={`+${entry.commit.additions}`} tone="success" />
                          <Chip label={`−${entry.commit.deletions}`} tone="danger" />
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function groupByDay(entries: ActivityEntry[]) {
  const groups = new Map<string, ActivityEntry[]>();
  entries.forEach((entry) => {
    const date = new Date(entry.commit.createdAt);
    const sameDay = (a: Date, b: Date) =>
      a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const label = sameDay(date, new Date())
      ? 'Today'
      : sameDay(date, new Date(Date.now() - 86_400_000))
        ? 'Yesterday'
        : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    const bucket = groups.get(label) ?? [];
    bucket.push(entry);
    groups.set(label, bucket);
  });
  return Array.from(groups.entries()).map(([label, list]) => ({ label, entries: list }));
}
