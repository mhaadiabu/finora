import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSmsAvailable } from '@/lib/sms';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';

const BASE_KEY = 'finora.integrations.v1';
const key = () => userStorageKey(BASE_KEY);

export type IntegrationsState = {
  gmailConnected: boolean;
  gmailEmail?: string;
  gmailConnectedAt?: string;
  /** @deprecated Prefer gmailConnectedAt — kept for older persisted state. */
  connectedAt?: string;
  calendarConnected: boolean;
  calendarEmail?: string;
  calendarConnectedAt?: string;
  smsConnected: boolean;
  smsPhone?: string;
  smsConnectedAt?: string;
};

const DEFAULT: IntegrationsState = {
  gmailConnected: false,
  calendarConnected: false,
  smsConnected: false,
};

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
    // memory fallback
  }
}

async function readState(storageKey = key()): Promise<IntegrationsState> {
  const raw = await getItem(storageKey);
  if (!raw) return { ...DEFAULT };
  try {
    const parsed = JSON.parse(raw) as Partial<IntegrationsState>;
    return {
      ...DEFAULT,
      ...parsed,
      gmailConnectedAt: parsed.gmailConnectedAt ?? parsed.connectedAt,
    };
  } catch {
    return { ...DEFAULT };
  }
}

async function writeState(storageKey: string, next: IntegrationsState): Promise<IntegrationsState> {
  await setItem(storageKey, JSON.stringify(next));
  return next;
}

export async function getIntegrations(): Promise<IntegrationsState> {
  return readState();
}

export async function connectGmail(email = 'kenneth@finora.business'): Promise<IntegrationsState> {
  const storageKey = key();
  const current = await readState(storageKey);
  const now = new Date().toISOString();
  return writeState(storageKey, {
    ...current,
    gmailConnected: true,
    gmailEmail: email,
    gmailConnectedAt: now,
    connectedAt: now,
  });
}

export async function disconnectGmail(): Promise<IntegrationsState> {
  const storageKey = key();
  const current = await readState(storageKey);
  return writeState(storageKey, {
    ...current,
    gmailConnected: false,
    gmailEmail: undefined,
    gmailConnectedAt: undefined,
    connectedAt: undefined,
  });
}

export async function connectGoogleCalendar(
  email = 'kenneth@finora.business',
): Promise<IntegrationsState> {
  const storageKey = key();
  const current = await readState(storageKey);
  return writeState(storageKey, {
    ...current,
    calendarConnected: true,
    calendarEmail: email,
    calendarConnectedAt: new Date().toISOString(),
  });
}

export async function disconnectGoogleCalendar(): Promise<IntegrationsState> {
  const storageKey = key();
  const current = await readState(storageKey);
  return writeState(storageKey, {
    ...current,
    calendarConnected: false,
    calendarEmail: undefined,
    calendarConnectedAt: undefined,
  });
}

export type ConnectSmsResult =
  | { ok: true; state: IntegrationsState }
  | { ok: false; error: string };

/** Verifies the system SMS composer is available, then marks SMS as connected. */
export async function connectSmsInbox(phone = 'This device'): Promise<ConnectSmsResult> {
  const available = await isSmsAvailable();
  if (!available) {
    return {
      ok: false,
      error:
        'SMS isn’t available on this device. Try a physical phone (simulators often can’t send SMS).',
    };
  }

  const storageKey = key();
  const current = await readState(storageKey);
  const state = await writeState(storageKey, {
    ...current,
    smsConnected: true,
    smsPhone: phone,
    smsConnectedAt: new Date().toISOString(),
  });
  return { ok: true, state };
}

export async function disconnectSmsInbox(): Promise<IntegrationsState> {
  const storageKey = key();
  const current = await readState(storageKey);
  return writeState(storageKey, {
    ...current,
    smsConnected: false,
    smsPhone: undefined,
    smsConnectedAt: undefined,
  });
}

export async function clearIntegrations(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
