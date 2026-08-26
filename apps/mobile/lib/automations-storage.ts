import AsyncStorage from '@react-native-async-storage/async-storage';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

export type Automation = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  status: 'active' | 'paused';
};

const BASE_KEY = 'finora.automations.v1';
const key = () => userStorageKey(BASE_KEY);
const memory = new Map<string, string>();

export const MOCK_AUTOMATIONS: Automation[] = [
  {
    id: 'auto-1',
    name: 'Pay small invoices',
    trigger: 'Gmail invoice under 500 USD',
    action: 'Prepare invoice payment for approval',
    status: 'active',
  },
  {
    id: 'auto-2',
    name: 'Operating float alert',
    trigger: 'USD wallet below 10,000',
    action: 'Notify in chat and Approvals',
    status: 'active',
  },
  {
    id: 'auto-3',
    name: 'Friday supplier batch',
    trigger: 'Every Friday 09:00',
    action: 'Prepare due supplier payments',
    status: 'paused',
  },
];

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

export async function listAutomations(storageKey = key()): Promise<Automation[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_AUTOMATIONS));
    return [...MOCK_AUTOMATIONS];
  }
  try {
    const parsed = JSON.parse(raw) as Automation[];
    return Array.isArray(parsed) ? parsed : [...MOCK_AUTOMATIONS];
  } catch {
    return [...MOCK_AUTOMATIONS];
  }
}

export async function setAutomationStatus(
  id: string,
  status: Automation['status'],
): Promise<Automation | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const items = await listAutomations(storageKey);
    const next = items.map((a) => (a.id === id ? { ...a, status } : a));
    await setItem(storageKey, JSON.stringify(next));
    return next.find((a) => a.id === id) ?? null;
  });
}

export async function clearAutomations(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
