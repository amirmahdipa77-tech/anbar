import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import { mono, monoRatio, space } from '../theme';
import { AppText, Button, Chip, Field, Header, IconButton, Screen, Segmented, Sheet, useTheme, useToast } from '../ui/kit';
import { plural, relativeTime, shortId } from '../core/format';
import type { Commit } from '../types';

type Mode = 'write' | 'rule';
type RulerColumn = 0 | 72 | 80 | 100;

const FONT_SIZES = [12, 13, 15] as const;

export function EditorScreen({
  path,
  initialContent,
  onSave,
  onBack,
  onDelete,
  onRename,
  isChanged,
  history,
  timeline,
}: {
  path: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onBack: () => void;
  onDelete: () => void;
  onRename: (nextPath: string) => Promise<void>;
  isChanged: boolean;
  history: Array<{ commit: Commit; additions: number; deletions: number }>;
  timeline: Array<{ id: string; message: string; createdAt: number; content: string }>;
}) {
  const { palette } = useTheme();
  const toast = useToast();

  const [value, setValue] = useState(initialContent);
  const [mode, setMode] = useState<Mode>('write');
  const [fontSize, setFontSize] = useState<number>(13);
  const [ruler, setRuler] = useState<RulerColumn>(80);
  const [status, setStatus] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const [caret, setCaret] = useState({ line: 1, column: 1 });
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();

  const [tools, setTools] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const [renameOpen, setRenameOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [renameValue, setRenameValue] = useState(path);
  const [error, setError] = useState<string | null>(null);

  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const lastPush = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const lines = useMemo(() => value.split('\n'), [value]);
  const gutterWidth = useMemo(() => Math.max(2, String(lines.length).length) * fontSize * monoRatio + 16, [lines.length, fontSize]);

  useEffect(() => {
    setValue(initialContent);
    setStatus('saved');
    past.current = [];
    future.current = [];
  }, [initialContent, path]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const persist = useCallback(
    async (next: string) => {
      setStatus('saving');
      await onSave(next);
      setStatus('saved');
    },
    [onSave],
  );

  const scheduleSave = useCallback(
    (next: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(next), 650);
    },
    [persist],
  );

  function commitValue(next: string, track = true) {
    if (track) {
      const now = Date.now();
      if (now - lastPush.current > 600) {
        past.current = [...past.current.slice(-60), value];
        lastPush.current = now;
        future.current = [];
      }
    }
    setValue(next);
    setStatus('dirty');
    scheduleSave(next);
  }

  function onChangeText(next: string) {
    commitValue(next);
    setSelection(undefined);
  }

  function onSelectionChange(
    event: NativeSyntheticEvent<{ selection: { start: number; end: number } }>,
  ) {
    const position = event.nativeEvent.selection.end;
    const before = value.slice(0, position);
    const line = before.split('\n').length;
    const column = position - before.lastIndexOf('\n');
    setCaret({ line, column });
  }

  function offsetOfLine(lineNumber: number): number {
    const target = Math.min(Math.max(1, lineNumber), lines.length);
    let offset = 0;
    for (let i = 0; i < target - 1; i += 1) offset += lines[i].length + 1;
    return offset;
  }

  function jumpToLine(lineNumber: number) {
    const offset = offsetOfLine(lineNumber);
    setSelection({ start: offset, end: offset });
    setMode('write');
    setTools(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function undo() {
    const previous = past.current.pop();
    if (previous === undefined) return;
    future.current = [value, ...future.current].slice(0, 60);
    setValue(previous);
    setStatus('dirty');
    scheduleSave(previous);
  }

  function redo() {
    const next = future.current.shift();
    if (next === undefined) return;
    past.current = [...past.current, value];
    setValue(next);
    setStatus('dirty');
    scheduleSave(next);
  }

  function currentLine() {
    const position = selection?.end ?? offsetOfLine(caret.line) + caret.column - 1;
    const before = value.slice(0, Math.max(0, position));
    return before.split('\n').length - 1; // zero based
  }

  function duplicateLine() {
    const index = currentLine();
    const next = [...lines];
    next.splice(index + 1, 0, next[index]);
    commitValue(next.join('\n'));
    toast('Line duplicated');
  }

  function moveLine(direction: -1 | 1) {
    const index = currentLine();
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    commitValue(next.join('\n'));
  }

  const matches = useMemo(() => {
    if (findQuery.length === 0) return [];
    const found: Array<{ index: number; line: number }> = [];
    let from = 0;
    const lowerValue = value.toLowerCase();
    const needle = findQuery.toLowerCase();
    while (found.length < 500) {
      const at = lowerValue.indexOf(needle, from);
      if (at === -1) break;
      found.push({ index: at, line: value.slice(0, at).split('\n').length });
      from = at + Math.max(1, needle.length);
    }
    return found;
  }, [findQuery, value]);

  function gotoMatch(direction: 1 | -1) {
    if (!matches.length) return;
    const next = (findIndex + direction + matches.length) % matches.length;
    setFindIndex(next);
    const match = matches[next];
    setSelection({ start: match.index, end: match.index + findQuery.length });
    setMode('write');
  }

  function replaceCurrent() {
    if (!matches.length) return;
    const match = matches[Math.min(findIndex, matches.length - 1)];
    const next = value.slice(0, match.index) + replaceValue + value.slice(match.index + findQuery.length);
    commitValue(next);
    toast('Replaced one match');
  }

  function replaceAll() {
    if (!matches.length) return;
    const pattern = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const next = value.replace(pattern, replaceValue);
    commitValue(next);
    toast(`Replaced ${matches.length} match${matches.length === 1 ? '' : 'es'}`);
  }

  const name = path.split('/').pop() ?? path;
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : 'root';
  const charWidth = fontSize * monoRatio;

  return (
    <Screen>
      <Header
        title={name}
        subtitle={`${folder}/ · line ${caret.line}, col ${caret.column}`}
        onBack={() => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          void persist(value).then(onBack);
        }}
        actions={
          <>
            {isChanged ? <Chip label="edited" tone="warn" /> : null}
            <IconButton name="ellipsis-horizontal" onPress={() => setTools(true)} accessibilityLabel="File tools" />
          </>
        }
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <View style={{ flex: 1 }}>
          <Segmented
            value={mode}
            onChange={(next) => setMode(next)}
            options={[
              { value: 'write', label: 'Write' },
              { value: 'rule', label: 'Ruled' },
            ]}
          />
        </View>
        <IconButton name="search" onPress={() => setFindOpen((open) => !open)} accessibilityLabel="Find in file" />
        <IconButton name="arrow-undo-outline" onPress={undo} accessibilityLabel="Undo" />
        <IconButton name="arrow-redo-outline" onPress={redo} accessibilityLabel="Redo" />
      </View>

      {findOpen ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <TextInput
              value={findQuery}
              onChangeText={(next) => {
                setFindQuery(next);
                setFindIndex(0);
              }}
              placeholder="Find"
              placeholderTextColor={palette.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.findInput, { borderColor: palette.line, backgroundColor: palette.surfaceAlt, color: palette.text }]}
            />
            <AppText variant="caption" faint style={{ width: 56, textAlign: 'center' }}>
              {matches.length ? `${findIndex + 1}/${matches.length}` : '0'}
            </AppText>
            <IconButton name="chevron-up" onPress={() => gotoMatch(-1)} accessibilityLabel="Previous match" />
            <IconButton name="chevron-down" onPress={() => gotoMatch(1)} accessibilityLabel="Next match" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
            <TextInput
              value={replaceValue}
              onChangeText={setReplaceValue}
              placeholder="Replace with"
              placeholderTextColor={palette.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.findInput, { borderColor: palette.line, backgroundColor: palette.surfaceAlt, color: palette.text }]}
            />
            <Button label="One" size="sm" onPress={replaceCurrent} />
            <Button label="All" size="sm" variant="primary" onPress={replaceAll} />
          </View>
        </View>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {mode === 'write' ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View
              style={{
                width: gutterWidth,
                overflow: 'hidden',
                backgroundColor: palette.surfaceAlt,
                borderRightWidth: StyleSheet.hairlineWidth,
                borderRightColor: palette.line,
              }}
            >
              <Animated.View style={{ paddingTop: space.lg, transform: [{ translateY: scrollY }] }}>
                {lines.map((_, index) => (
                  <AppText
                    key={index}
                    variant="mono"
                    style={{
                      fontSize,
                      lineHeight: fontSize * 1.55,
                      textAlign: 'right',
                      paddingRight: 7,
                      color: index + 1 === caret.line ? palette.accent : palette.faint,
                    }}
                  >
                    {index + 1}
                  </AppText>
                ))}
              </Animated.View>
            </View>

            <View style={{ flex: 1 }}>
              {ruler > 0 ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: space.lg + charWidth * ruler,
                    width: StyleSheet.hairlineWidth,
                    backgroundColor: palette.line,
                    zIndex: 1,
                  }}
                />
              ) : null}
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={onChangeText}
                onSelectionChange={onSelectionChange}
                onScroll={(event) =>
                  scrollY.setValue((event.nativeEvent as { contentOffset?: { y: number } }).contentOffset?.y ?? 0)
                }
                onBlur={() => void persist(value)}
                selection={selection}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textAlignVertical="top"
                scrollEnabled
                style={{
                  flex: 1,
                  padding: space.lg,
                  color: palette.text,
                  fontFamily: mono,
                  fontSize,
                  lineHeight: fontSize * 1.55,
                }}
                placeholder="Start typing…"
                placeholderTextColor={palette.faint}
              />
            </View>
          </View>
        ) : (
          <RuledView
            lines={lines}
            fontSize={fontSize}
            ruler={ruler}
            caretLine={caret.line}
            onPressLine={jumpToLine}
            gutterWidth={gutterWidth}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: space.lg,
            paddingVertical: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: palette.line,
            backgroundColor: palette.surface,
          }}
        >
          <AppText variant="caption" faint>
            {plural(lines.length, 'line')} · {value.length} chars · {ruler ? `${ruler} cols` : 'no ruler'}
          </AppText>
          <AppText variant="caption" style={{ color: status === 'saved' ? palette.success : palette.muted }}>
            {status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Unsaved'}
          </AppText>
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={tools} onClose={() => setTools(false)} title="File tools">
        <ToolRow icon="text-outline" title="Ruler" detail={ruler ? `${ruler} columns` : 'off'} onPress={() => {
          const order: RulerColumn[] = [0, 72, 80, 100];
          setRuler(order[(order.indexOf(ruler) + 1) % order.length]);
        }} />
        <ToolRow icon="resize-outline" title="Font size" detail={`${fontSize} pt`} onPress={() => {
          setFontSize(FONT_SIZES[(FONT_SIZES.indexOf(fontSize as 12 | 13 | 15) + 1) % FONT_SIZES.length]);
        }} />
        <ToolRow icon="copy-outline" title="Duplicate line" detail={`line ${caret.line}`} onPress={() => { duplicateLine(); setTools(false); }} />
        <ToolRow icon="arrow-up-outline" title="Move line up" onPress={() => { moveLine(-1); setTools(false); }} />
        <ToolRow icon="arrow-down-outline" title="Move line down" onPress={() => { moveLine(1); setTools(false); }} />
        <ToolRow icon="locate-outline" title="Go to line" detail="jump" onPress={() => { setTools(false); jumpToLine(Math.max(1, caret.line)); }} />
        <ToolRow
          icon="hourglass-outline"
          title="Time machine"
          detail={plural(timeline.length, 'version')}
          onPress={() => { setTools(false); setTimeIndex(0); setTimeOpen(true); }}
        />
        <ToolRow
          icon="time-outline"
          title="History of this file"
          detail={plural(history.length, 'commit')}
          onPress={() => { setTools(false); setHistoryOpen(true); }}
        />
        <ToolRow icon="pencil-outline" title="Rename or move file" detail={path} onPress={() => { setTools(false); setRenameValue(path); setRenameOpen(true); }} />
        <ToolRow icon="trash-outline" title="Delete file" danger onPress={() => { setTools(false); onDelete(); }} />
      </Sheet>

      <Sheet visible={timeOpen} onClose={() => setTimeOpen(false)} title="Time machine">
        {timeline.length === 0 ? (
          <AppText variant="body" muted>
            No committed versions of this file yet.
          </AppText>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <IconButton
                name="chevron-back"
                onPress={() => setTimeIndex((index) => Math.min(timeline.length - 1, index + 1))}
                accessibilityLabel="Older"
                disabled={timeIndex >= timeline.length - 1}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="caption" faint>
                  {relativeTime(timeline[timeIndex].createdAt)} · {shortId(timeline[timeIndex].id)}
                </AppText>
                <AppText variant="label" numberOfLines={1}>
                  {timeline[timeIndex].message}
                </AppText>
              </View>
              <IconButton
                name="chevron-forward"
                onPress={() => setTimeIndex((index) => Math.max(0, index - 1))}
                accessibilityLabel="Newer"
                disabled={timeIndex === 0}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 3, marginVertical: space.md }}>
              {timeline.map((entry, index) => (
                <Pressable
                  key={entry.id}
                  onPress={() => setTimeIndex(index)}
                  accessibilityLabel={`Version ${timeline.length - index}`}
                  style={{
                    flex: 1,
                    height: 18,
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      height: index === timeIndex ? 4 : 2,
                      borderRadius: 2,
                      backgroundColor: index === timeIndex ? palette.accent : palette.line,
                    }}
                  />
                </Pressable>
              ))}
            </View>

            <ScrollView
              style={{
                maxHeight: 300,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: palette.surfaceAlt,
              }}
              contentContainerStyle={{ padding: space.md }}
            >
              <AppText variant="mono" selectable style={{ fontSize: 12, lineHeight: 18 }}>
                {timeline[timeIndex].content || '(empty at this point)'}
              </AppText>
            </ScrollView>
          </View>
        )}
      </Sheet>

      <Sheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="History of this file"
      >
        {history.length === 0 ? (
          <AppText variant="body" muted>
            This file has not changed in any commit yet.
          </AppText>
        ) : (
          history.map((entry) => (
            <View
              key={entry.commit.id}
              style={{ paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.lineSoft }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText variant="mono" faint>
                  {shortId(entry.commit.id)}
                </AppText>
                <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {entry.commit.message}
                </AppText>
              </View>
              <AppText variant="caption" faint style={{ marginTop: 3 }}>
                {entry.commit.author} · {relativeTime(entry.commit.createdAt)} · +{entry.additions} −
                {entry.deletions}
              </AppText>
            </View>
          ))
        )}
      </Sheet>

      <Sheet
        visible={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename or move"
        footer={
          <Button
            label="Save path"
            variant="primary"
            onPress={() => {
              const next = renameValue.trim();
              if (!next || next === path) {
                setRenameOpen(false);
                return;
              }
              void onRename(next)
                .then(() => {
                  setRenameOpen(false);
                  toast('Path updated', 'success');
                })
                .catch((err: Error) => setError(err.message));
            }}
          />
        }
      >
        <Field
          label="Path"
          value={renameValue}
          onChangeText={setRenameValue}
          autoCapitalize="none"
          autoCorrect={false}
          error={error ?? undefined}
          hint="A slash moves the file into another folder."
        />
      </Sheet>
    </Screen>
  );
}

function ToolRow({
  icon,
  title,
  detail,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={danger ? palette.danger : palette.muted} />
      <AppText variant="body" style={{ flex: 1, color: danger ? palette.danger : palette.text }}>
        {title}
      </AppText>
      {detail ? (
        <AppText variant="caption" faint numberOfLines={1} style={{ maxWidth: 150 }}>
          {detail}
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={14} color={palette.faint} />
    </Pressable>
  );
}

/**
 * The ruled view: a precise, non-wrapping render of the file.
 * Every line is its own row, so the gutter, the column ruler and the
 * horizontal scroll can never drift out of alignment.
 */
function RuledView({
  lines,
  fontSize,
  ruler,
  caretLine,
  onPressLine,
  gutterWidth,
}: {
  lines: string[];
  fontSize: number;
  ruler: number;
  caretLine: number;
  onPressLine: (line: number) => void;
  gutterWidth: number;
}) {
  const { palette } = useTheme();
  const charWidth = fontSize * monoRatio;
  const lineHeight = fontSize * 1.55;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: gutterWidth + (ruler || 0) * charWidth,
              width: StyleSheet.hairlineWidth,
              backgroundColor: palette.line,
              display: ruler ? 'flex' : 'none',
            }}
          />
          {lines.map((line, index) => {
            const active = index + 1 === caretLine;
            return (
              <Pressable
                key={index}
                onPress={() => onPressLine(index + 1)}
                style={{ flexDirection: 'row', backgroundColor: active ? palette.accentSoft : 'transparent' }}
              >
                <AppText
                  variant="mono"
                  faint
                  style={{
                    width: gutterWidth,
                    paddingRight: 8,
                    textAlign: 'right',
                    fontSize,
                    lineHeight,
                    color: active ? palette.accent : palette.faint,
                  }}
                >
                  {index + 1}
                </AppText>
                <AppText
                  variant="mono"
                  style={{ fontSize, lineHeight, color: palette.text, paddingRight: space.xl, fontFamily: mono }}
                >
                  {line || ' '}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  findInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    fontSize: 14,
  },
});
