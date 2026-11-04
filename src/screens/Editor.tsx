import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { plural } from '../core/format';
import { mono, space } from '../theme';
import { AppText, Chip, Header, IconButton, Screen, useTheme } from '../ui/kit';

export function EditorScreen({
  path,
  initialContent,
  onSave,
  onBack,
  onDelete,
  isChanged,
}: {
  path: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onBack: () => void;
  onDelete: () => void;
  isChanged: boolean;
}) {
  const { palette } = useTheme();
  const [value, setValue] = useState(initialContent);
  const [state, setState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initialContent);
    setState('saved');
  }, [initialContent, path]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const lines = useMemo(() => value.split('\n').length, [value]);
  const name = path.split('/').pop() ?? path;
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

  function change(next: string) {
    setValue(next);
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState('saving');
      void onSave(next).then(() => setState('saved'));
    }, 650);
  }

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    setState('saving');
    await onSave(value);
    setState('saved');
  }

  return (
    <Screen>
      <Header
        title={name}
        subtitle={folder ? `${folder}/` : 'root'}
        onBack={() => {
          void flush().then(onBack);
        }}
        actions={
          <>
            {isChanged ? <Chip label="edited" tone="warn" /> : null}
            <IconButton name="trash-outline" tone="danger" onPress={onDelete} accessibilityLabel="Delete file" />
          </>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardDismissMode="interactive"
        >
          <TextInput
            value={value}
            onChangeText={change}
            onBlur={() => void flush()}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
            style={{
              flex: 1,
              minHeight: 380,
              padding: space.lg,
              color: palette.text,
              fontFamily: mono,
              fontSize: 13,
              lineHeight: 20,
            }}
            placeholder="Start typing…"
            placeholderTextColor={palette.faint}
          />
        </ScrollView>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: space.lg,
            paddingVertical: 9,
            borderTopWidth: 1,
            borderTopColor: palette.line,
          }}
        >
          <AppText variant="caption" faint>
            {plural(lines, 'line')} · {value.length} chars
          </AppText>
          <AppText variant="caption" style={{ color: state === 'saved' ? palette.success : palette.muted }}>
            {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved'}
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
