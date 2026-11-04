import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { space } from '../theme';
import type { FileTree } from '../types';
import { AppText, Divider, EmptyState, Header, Row, Screen, useTheme } from '../ui/kit';

type Hit = { path: string; line: number; text: string };

/** Search inside every file of a project. */
export function FindScreen({
  files,
  onOpen,
  onBack,
}: {
  files: FileTree;
  onOpen: (path: string) => void;
  onBack: () => void;
}) {
  const { palette } = useTheme();
  const [query, setQuery] = useState('');

  const hits = useMemo<Hit[]>(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    const results: Hit[] = [];
    Object.keys(files)
      .sort()
      .forEach((path) => {
        files[path].split('\n').forEach((text, index) => {
          if (text.toLowerCase().includes(needle) && results.length < 200) {
            results.push({ path, line: index + 1, text: text.trim().slice(0, 120) });
          }
        });
      });
    return results;
  }, [files, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Hit[]>();
    hits.forEach((hit) => {
      const bucket = map.get(hit.path) ?? [];
      bucket.push(hit);
      map.set(hit.path, bucket);
    });
    return Array.from(map.entries());
  }, [hits]);

  return (
    <Screen>
      <Header title="Find in files" subtitle={query ? `${hits.length} matches` : 'Type at least two letters'} onBack={onBack} />

      <View style={{ padding: space.lg }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder="Search this project"
          placeholderTextColor={palette.faint}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderColor: palette.line,
            backgroundColor: palette.surfaceAlt,
            color: palette.text,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
          }}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {query.trim().length < 2 ? (
          <EmptyState icon="search" title="Search inside every file" body="Results show the file and the matching line." />
        ) : grouped.length === 0 ? (
          <EmptyState icon="search" title="No matches" body="Try a shorter or different word." />
        ) : (
          <View style={{ paddingHorizontal: space.lg }}>
            {grouped.map(([path, fileHits]) => (
              <View key={path} style={{ marginBottom: space.lg }}>
                <AppText variant="caption" faint style={{ marginBottom: 6 }}>
                  {path}
                </AppText>
                <View style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.surface }}>
                  {fileHits.map((hit, index) => (
                    <View key={`${path}-${hit.line}`}>
                      {index > 0 ? <Divider inset={space.md} /> : null}
                      <Row
                        title={hit.text || '(blank line)'}
                        subtitle={`line ${hit.line}`}
                        mono
                        onPress={() => onOpen(path)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
