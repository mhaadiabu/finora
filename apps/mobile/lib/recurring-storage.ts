import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MOCK_RECURRING,
  type RecurringPayment,
  type RecurringStatus,
} from '@/components/recurring/types';

import { userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

const BASE_KEY = 'finora.recurring.v1';
const key = () => userStorageKey(BASE_KEY);

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeRecurring(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // memory fallback
  }
}

export async function listRecurring(): Promise<RecurringPayment[]> {
  const raw = await getItem(key());
  if (!raw) {
    await setItem(key(), JSON.stringify(MOCK_RECURRING));
    return [...MOCK_RECURRING];
  }
  try {
    const parsed = JSON.parse(raw) as RecurringPayment[];
    return Array.isArray(parsed) ? parsed : [...MOCK_RECURRING];
  } catch {
    return [...MOCK_RECURRING];
  }
}

export async function saveRecurring(payment: RecurringPayment): Promise<RecurringPayment> {
  return serializeStorageMutation(key(), async () => {
    const items = await listRecurring();
    await setItem(
      key(),
      JSON.stringify([payment, ...items.filter((item) => item.id !== payment.id)]),
    );
    notify();
    return payment;
  });
}

export async function updateRecurringStatus(
  id: string,
  status: RecurringStatus,
): Promise<RecurringPayment | null> {
  return serializeStorageMutation(key(), async () => {
    const items = await listRecurring();
    const idx = items.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const next: RecurringPayment = { ...items[idx]!, status };
    await setItem(key(), JSON.stringify(items.map((r, i) => (i === idx ? next : r))));
    notify();
    return next;
  });
}

export async function clearRecurring(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
  notify();
}
