import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import type { Settings } from '../types';

/**
 * App lock.
 *
 * The PIN itself is never stored: we keep a random salt and a SHA-256 of
 * `salt:pin`. Verification re-hashes the input. Biometric unlock is delegated
 * to the OS keyguard and only switches the gate, it does not reveal the PIN.
 */

const SETTINGS_KEY = 'anbar:v2:settings';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  author: 'You',
  lockEnabled: false,
  biometric: false,
  salt: null,
  hash: null,
  autoLockMs: 60_000,
};

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(next: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function makeSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return toHex(bytes);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function setPin(pin: string): Promise<Settings> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('Use 4 to 6 digits.');
  const salt = await makeSalt();
  const hash = await hashPin(pin, salt);
  const current = await loadSettings();
  const next: Settings = { ...current, lockEnabled: true, salt, hash };
  await saveSettings(next);
  return next;
}

export async function verifyPin(pin: string, settings: Settings): Promise<boolean> {
  if (!settings.salt || !settings.hash) return false;
  const hash = await hashPin(pin, settings.salt);
  return hash === settings.hash;
}

export async function clearPin(): Promise<Settings> {
  const current = await loadSettings();
  const next: Settings = { ...current, lockEnabled: false, salt: null, hash: null };
  await saveSettings(next);
  return next;
}

export async function biometricSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export async function biometricUnlock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Anbar',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
