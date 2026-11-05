import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { biometricSupported, clearPin, saveSettings, setPin, verifyPin } from '../security/pin';
import { space } from '../theme';
import type { Settings } from '../types';
import {
  AppText,
  Button,
  Card,
  Divider,
  Field,
  Header,
  Row,
  Screen,
  Segmented,
  Sheet,
  useTheme,
  useToast,
} from '../ui/kit';

const AUTO_LOCK = [
  { label: 'Immediately', value: 0 },
  { label: '1 minute', value: 60_000 },
  { label: '5 minutes', value: 300_000 },
  { label: '15 minutes', value: 900_000 },
];

export function SettingsScreen({
  settings,
  onChange,
  onBack,
  onExport,
  onImport,
  onErase,
}: {
  settings: Settings;
  onChange: (next: Settings) => Promise<void>;
  onBack: () => void;
  onExport: () => Promise<string>;
  onImport: (raw: string) => Promise<number>;
  onErase: () => Promise<void>;
}) {
  const { palette } = useTheme();
  const toast = useToast();
  const [pinSheet, setPinSheet] = useState<'set' | 'remove' | null>(null);
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [importSheet, setImportSheet] = useState(false);
  const [importText, setImportText] = useState('');
  const [eraseSheet, setEraseSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void biometricSupported().then(setBioAvailable);
  }, []);

  async function submitPin() {
    setError(null);
    setBusy(true);
    try {
      if (pinSheet === 'set') {
        if (pin !== confirm) throw new Error('The two PINs do not match.');
        const next = await setPin(pin);
        await onChange(next);
        toast('App lock enabled', 'success');
      } else {
        const ok = await verifyPin(pin, settings);
        if (!ok) throw new Error('Wrong PIN.');
        const next = await clearPin();
        await onChange(next);
        toast('App lock removed', 'success');
      }
      setPinSheet(null);
      setPinValue('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the PIN.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Settings" onBack={onBack} />

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
        <Section title="Appearance" defaultOpen>
        <Segmented
          value={settings.theme}
          onChange={(theme) => void onChange({ ...settings, theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        </Section>

        <Section title="Identity" defaultOpen>
        <Card style={{ padding: 0 }}>
          <View style={{ padding: space.lg }}>
            <Field
              label="Author name"
              value={settings.author}
              onChangeText={(author) => void onChange({ ...settings, author })}
              placeholder="Your name"
            />
            <AppText variant="caption" faint style={{ marginTop: -4 }}>
              Written into every commit you make.
            </AppText>
          </View>
        </Card>

        </Section>

        <Section title="Security">
        <Card style={{ padding: 0 }}>
          <Row
            title="App lock"
            subtitle={settings.lockEnabled ? 'A PIN is required to open Anbar' : 'No PIN set'}
            left={<Ionicons name="lock-closed-outline" size={18} color={palette.muted} />}
            right={
              <Switch
                value={settings.lockEnabled}
                onValueChange={(enabled) => {
                  setError(null);
                  setPinValue('');
                  setConfirm('');
                  setPinSheet(enabled ? 'set' : 'remove');
                }}
                trackColor={{ true: palette.accent, false: palette.line }}
                thumbColor="#FFFFFF"
              />
            }
          />
          {settings.lockEnabled ? (
            <>
              <Divider inset={space.lg} />
              <Row
                title="Unlock with biometrics"
                subtitle={bioAvailable ? 'Fingerprint or face' : 'Not available on this device'}
                left={<Ionicons name="finger-print-outline" size={18} color={palette.muted} />}
                right={
                  <Switch
                    disabled={!bioAvailable}
                    value={settings.biometric && bioAvailable}
                    onValueChange={(biometric) => void onChange({ ...settings, biometric })}
                    trackColor={{ true: palette.accent, false: palette.line }}
                    thumbColor="#FFFFFF"
                  />
                }
              />
              <Divider inset={space.lg} />
              <Row
                title="Lock after"
                subtitle={AUTO_LOCK.find((option) => option.value === settings.autoLockMs)?.label}
                left={<Ionicons name="time-outline" size={18} color={palette.muted} />}
                onPress={() => {
                  const index = AUTO_LOCK.findIndex((option) => option.value === settings.autoLockMs);
                  const next = AUTO_LOCK[(index + 1) % AUTO_LOCK.length];
                  void onChange({ ...settings, autoLockMs: next.value });
                }}
              />
            </>
          ) : null}
        </Card>

        </Section>

        <Section title="Data">
        <Card style={{ padding: 0 }}>
          <Row
            title="Export backup"
            subtitle="Copies every project, file and commit as JSON"
            left={<Ionicons name="arrow-up-outline" size={18} color={palette.muted} />}
            onPress={() => {
              void onExport()
                .then((json) => Clipboard.setStringAsync(json))
                .then(() => toast('Backup copied to the clipboard', 'success'))
                .catch((err: Error) => toast(err.message, 'error'));
            }}
          />
          <Divider inset={space.lg} />
          <Row
            title="Import backup"
            subtitle="Paste a backup and merge it in"
            left={<Ionicons name="arrow-down-outline" size={18} color={palette.muted} />}
            onPress={() => {
              setImportText('');
              setImportSheet(true);
            }}
          />
          <Divider inset={space.lg} />
          <Row
            title="Erase everything"
            subtitle="Every project on this device, permanently"
            left={<Ionicons name="warning-outline" size={18} color={palette.danger} />}
            onPress={() => setEraseSheet(true)}
          />
        </Card>

        </Section>

        <Section title="About">
        <Card>
          <AppText variant="body" style={{ lineHeight: 22 }}>
            Anbar 2.0 · a local workspace for code. Files, commits and history live in this device’s
            storage. The Android build ships without the INTERNET permission, so the app has no way to
            send anything anywhere.
          </AppText>
          <AppText variant="caption" faint style={{ marginTop: space.sm }}>
            MIT licensed · made by Amirmahdi Pop
          </AppText>
        </Card>
        </Section>
      </ScrollView>

      <Sheet
        visible={pinSheet !== null}
        onClose={() => setPinSheet(null)}
        title={pinSheet === 'set' ? 'Set a PIN' : 'Turn off the lock'}
        footer={
          <Button
            label={pinSheet === 'set' ? 'Enable lock' : 'Remove lock'}
            variant={pinSheet === 'set' ? 'primary' : 'danger'}
            disabled={busy || pin.length < 4}
            onPress={() => void submitPin()}
          />
        }
      >
        <Field
          label={pinSheet === 'set' ? 'New PIN (4–6 digits)' : 'Current PIN'}
          value={pin}
          onChangeText={setPinValue}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          error={error ?? undefined}
        />
        {pinSheet === 'set' ? (
          <Field label="Repeat PIN" value={confirm} onChangeText={setConfirm} keyboardType="number-pad" secureTextEntry maxLength={6} />
        ) : null}
        <AppText variant="caption" faint>
          Only a salted SHA-256 hash is stored — never the PIN itself.
        </AppText>
      </Sheet>

      <Sheet
        visible={importSheet}
        onClose={() => setImportSheet(false)}
        title="Import backup"
        footer={
          <Button
            label="Import"
            variant="primary"
            disabled={busy || importText.trim().length === 0}
            onPress={() => {
              setBusy(true);
              void onImport(importText)
                .then((count) => {
                  toast(`Imported ${count} project(s)`, 'success');
                  setImportSheet(false);
                })
                .catch((err: Error) => toast(err.message, 'error'))
                .finally(() => setBusy(false));
            }}
          />
        }
      >
        <Field
          label="Backup JSON"
          value={importText}
          onChangeText={setImportText}
          placeholder={'{ "app": "anbar", … }'}
          multiline
          numberOfLines={6}
          style={{ minHeight: 110 }}
        />
        <Button
          label="Paste from clipboard"
          size="sm"
          onPress={() => {
            void Clipboard.getStringAsync().then(setImportText);
          }}
        />
      </Sheet>

      <Sheet
        visible={eraseSheet}
        onClose={() => setEraseSheet(false)}
        title="Erase everything?"
        footer={
          <Button
            label="Erase all projects"
            variant="danger"
            onPress={() => {
              void onErase().then(() => {
                setEraseSheet(false);
                toast('Everything erased', 'success');
              });
            }}
          />
        }
      >
        <AppText variant="body" muted style={{ lineHeight: 21 }}>
          This deletes every project, file and commit stored on this device. Export a backup first if you
          might want them back.
        </AppText>
      </Sheet>
    </Screen>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { palette } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ marginTop: space.xl }}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={`${title} section`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingVertical: 10,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <AppText
          variant="caption"
          faint
          style={{ textTransform: 'uppercase', letterSpacing: 0.7, flex: 1 }}
        >
          {title}
        </AppText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={palette.faint}
        />
      </Pressable>
      {open ? <View>{children}</View> : null}
    </View>
  );
}

const labelStyle = {
  textTransform: 'uppercase' as const,
  letterSpacing: 0.7,
  marginTop: space.xl,
  marginBottom: space.sm,
};
