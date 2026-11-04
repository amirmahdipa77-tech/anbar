import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { space } from '../theme';
import { searchAll, type SearchHit } from '../storage/db';
import { AppText, Card, EmptyState, Header, Screen, useTheme } from '../ui/kit';

export function SearchScreen({
  onOpenHit,
  version,
}: {
  onOpenHit: (hit: SearchHit) => void;
  version: number;
}) {
  const { palette } = useTheme();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) {
      setHits([]);
      setBusy(false);
      return () => {
        alive = false;
      };
    }
    setBusy(true);
    const timer = setTimeout(() => {
      void searchAll(query).then((result) => {
        if (alive) {
          setHits(result);
          setBusy(false);
        }
      });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, version]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    hits.forEach((hit) => {
      const key = `${hit.projectName} · ${hit.path}`;
      const bucket = map.get(key) ?? [];
      bucket.push(hit);
      map.set(key, bucket);
    });
    return Array.from(map.entries());
  }, [hits]);

  return (
    <Screen>
      <Header title="Search" subtitle="Every file in every project" large />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: palette.line,
            backgroundColor: palette.surfaceAlt,
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 42,
          }}
        >
          <Ionicons name="search" size={16} color={palette.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search code and notes"
            placeholderTextColor={palette.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: palette.text, fontSize: 15, padding: 0 }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={palette.faint} />
            </Pressable>
          ) : null}
        </View>
        <AppText variant="caption" faint style={{ marginTop: space.sm }}>
          {query.trim().length < 2
            ? 'Type at least two characters.'
            : busy
              ? 'Searching…'
              : `${hits.length} match${hits.length === 1 ? '' : 'es'}`}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {query.trim().length >= 2 && !busy && hits.length === 0 ? (
          <EmptyState icon="search" title="No matches" body="Try a shorter word, or a different project." />
        ) : (
          grouped.map(([label, group]) => (
            <View key={label} style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
              <AppText variant="caption" faint style={{ marginBottom: 6 }} numberOfLines={1}>
                {label}
              </AppText>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {group.map((hit, index) => (
                  <View key={`${hit.path}-${hit.line}`}>
                    {index > 0 ? (
                      <View style={{ height: 1, backgroundColor: palette.lineSoft, marginLeft: space.lg }} />
                    ) : null}
                    <Pressable
                      onPress={() => onOpenHit(hit)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <View style={{ padding: space.md, paddingHorizontal: space.lg }}>
                        <AppText variant="mono" numberOfLines={1} style={{ color: palette.text }}>
                          {hit.text || '(blank line)'}
                        </AppText>
                        <AppText variant="caption" faint style={{ marginTop: 3 }}>
                          {hit.projectName} · line {hit.line}
                        </AppText>
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
