import AsyncStorage from '@react-native-async-storage/async-storage';

import { userStorageKey } from './session-storage';

const TAG_CONFIGURED_KEY = 'finora.auth.tagConfigured';

const memory = new Map<string, string>();

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
    // Session still valid for this process via memory.
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

export async function getTagConfigured(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  return (await getItem(userStorageKey(TAG_CONFIGURED_KEY))) === '1';
}

export async function setTagConfigured(_userId: string): Promise<void> {
  await setItem(userStorageKey(TAG_CONFIGURED_KEY), '1');
}

export async function clearTagConfigured(): Promise<void> {
  await removeItem(userStorageKey(TAG_CONFIGURED_KEY));
}
