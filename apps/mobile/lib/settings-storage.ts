import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSystemLanguage } from './i18n';
import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { getActiveUserId } from './session-storage';

const BASE_KEY = 'finora.settings.v1';
const key = () => userStorageKey(BASE_KEY);

const memory = new Map<string, string>();

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (!isUserStorageKeyWritable(key)) return;
  memory.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Still valid for this process via memory.
  }
}

async function removeItem(key: string): Promise<void> {
  memory.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppLanguage = 'en' | 'fr';

export type NotificationPrefs = {
  approvals: boolean;
  payments: boolean;
  invoices: boolean;
  marketing: boolean;
};

export type TrustedDevice = {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'web';
  lastActiveAt: string;
  current?: boolean;
};

export type FinoraSettings = {
  displayName: string;
  email: string;
  finoraTag: string;
  theme: ThemePreference;
  language: AppLanguage;
  largerText: boolean;
  biometricsEnabled: boolean;
  hapticsEnabled: boolean;
  notifications: NotificationPrefs;
  trustedDevices: TrustedDevice[];
};

export const DEFAULT_SETTINGS: FinoraSettings = {
  displayName: 'Kenneth Owusu',
  email: 'kenneth@finora.app',
  finoraTag: 'kennethowusu',
  theme: 'system',
  language: getSystemLanguage(),
  largerText: false,
  biometricsEnabled: false,
  hapticsEnabled: true,
  notifications: {
    approvals: true,
    payments: true,
    invoices: true,
    marketing: false,
  },
  trustedDevices: [],
  /* Legacy local trusted-device data is intentionally unused. */
  /*
    {
      id: 'dev-this',
      name: 'This device',
      platform: 'ios',
      lastActiveAt: new Date().toISOString(),
      current: true,
    },
    {
      id: 'dev-mac',
      name: 'Kenneth’s MacBook',
      platform: 'web',
      lastActiveAt: '2026-08-02T18:20:00Z',
    },
  ], */
};

let cached: FinoraSettings | null = null;
let cachedUserId: string | null = null;
let writeQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCachedSettings(): FinoraSettings {
  return cachedUserId === getActiveUserId() ? (cached ?? DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
}

export async function getSettings(): Promise<FinoraSettings> {
  const userId = getActiveUserId();
  const storageKey = userStorageKey(BASE_KEY, userId);
  const raw = await getItem(storageKey);
  const fallback = () => ({
    ...DEFAULT_SETTINGS,
    notifications: { ...DEFAULT_SETTINGS.notifications },
  });
  if (!raw) {
    const next = fallback();
    if (getActiveUserId() === userId) {
      cachedUserId = userId;
      cached = next;
    }
    return next;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FinoraSettings>;
    const next = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...parsed.notifications,
      },
      trustedDevices: parsed.trustedDevices ?? DEFAULT_SETTINGS.trustedDevices,
    };
    if (getActiveUserId() === userId) {
      cachedUserId = userId;
      cached = next;
    }
    return next;
  } catch {
    const next = fallback();
    if (getActiveUserId() === userId) {
      cachedUserId = userId;
      cached = next;
    }
    return next;
  }
}

export async function saveSettings(patch: Partial<FinoraSettings>): Promise<FinoraSettings> {
  const operation = writeQueue.then(async () => {
    const userId = getActiveUserId();
    const storageKey = userStorageKey(BASE_KEY, userId);
    const current =
      cachedUserId === userId ? (cached ?? (await getSettings())) : await getSettings();
    const next: FinoraSettings = {
      ...current,
      ...patch,
      notifications: {
        ...current.notifications,
        ...patch.notifications,
      },
      trustedDevices: patch.trustedDevices ?? current.trustedDevices,
    };
    if (getActiveUserId() !== userId) return current;
    cached = next;
    cachedUserId = userId;
    await setItem(storageKey, JSON.stringify(next));
    notify();
    return next;
  });
  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

export async function revokeTrustedDevice(id: string): Promise<FinoraSettings> {
  const current = await getSettings();
  const device = current.trustedDevices.find((d) => d.id === id);
  if (!device || device.current) return current;
  return saveSettings({
    trustedDevices: current.trustedDevices.filter((d) => d.id !== id),
  });
}

export async function clearSettings(): Promise<void> {
  const storageKey = key();
  cached = null;
  cachedUserId = null;
  await removeItem(storageKey);
  notify();
}
