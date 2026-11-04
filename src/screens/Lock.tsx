import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { biometricSupported, biometricUnlock, verifyPin } from '../security/pin';
import { space } from '../theme';
import type { Settings } from '../types';
import { AppText, Screen, useTheme } from '../ui/kit';

export function LockScreen({
  settings,
  onUnlock,
}: {
  settings: Settings;
  onUnlock: () => void;
}) {
  const { palette } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [bio, setBio] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void biometricSupported().then(async (available) => {
      setBio(available && settings.biometric);
      if (available && settings.biometric) {
        const ok = await biometricUnlock();
        if (ok) onUnlock();
      }
    });
  }, [settings.biometric, onUnlock]);

  function reject() {
    setError(true);
    setPin('');
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start(() => setError(false));
  }

  async function check(next: string) {
    if (next.length < 4) return;
    const ok = await verifyPin(next, settings);
    if (ok) {
      onUnlock();
      return;
    }
    if (next.length === 6) reject();
  }

  function press(digit: string) {
    if (pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    void check(next);
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.accentSoft,
            marginBottom: space.lg,
          }}
        >
          <Ionicons name="lock-closed" size={24} color={palette.accent} />
        </View>
        <AppText variant="title">Anbar is locked</AppText>
        <AppText variant="body" muted style={{ marginTop: 6 }}>
          Enter your PIN to open your projects
        </AppText>

        <Animated.View
          style={{
            flexDirection: 'row',
            gap: 12,
            marginVertical: space.xxl,
            transform: [
              {
                translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }),
              },
            ],
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View
              key={index}
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: index < pin.length ? (error ? palette.danger : palette.text) : palette.line,
              }}
            />
          ))}
        </Animated.View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 264, justifyContent: 'center', gap: space.md }}>
          {keys.map((key, index) =>
            key === '' ? (
              <View key={index} style={{ width: 72, height: 62 }} />
            ) : (
              <Pressable
                key={key}
                onPress={() => (key === 'del' ? setPin(pin.slice(0, -1)) : press(key))}
                style={({ pressed }) => ({
                  width: 72,
                  height: 62,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? palette.surfaceAlt : 'transparent',
                  borderWidth: key === 'del' ? 0 : 1,
                  borderColor: palette.line,
                })}
              >
                {key === 'del' ? (
                  <Ionicons name="backspace-outline" size={20} color={palette.muted} />
                ) : (
                  <AppText variant="title">{key}</AppText>
                )}
              </Pressable>
            ),
          )}
        </View>

        {bio ? (
          <Pressable
            onPress={async () => {
              const ok = await biometricUnlock();
              if (ok) onUnlock();
            }}
            style={{ marginTop: space.xl, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Ionicons name="finger-print" size={20} color={palette.accent} />
            <AppText variant="label" style={{ color: palette.accent }}>
              Unlock with biometrics
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
