import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AccountType } from '@/lib/account';

import { userStorageKey } from './session-storage';

const KEYS = {
  completed: 'finora.onboarding.completed',
  accountType: 'finora.accountType',
} as const;

const key = (baseKey: (typeof KEYS)[keyof typeof KEYS]) => userStorageKey(baseKey);

export type OnboardingState = {
  completed: boolean;
  accountType: AccountType | null;
};

function parseAccountType(value: string | null): AccountType | null {
  if (value === 'personal' || value === 'business') return value;
  return null;
}

/** In-memory fallback when native AsyncStorage isn't available (e.g. mismatched native binary). */
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
    // Keep memory write so the current session still gates correctly.
  }
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const [completed, accountType] = await Promise.all([
    getItem(key(KEYS.completed)),
    getItem(key(KEYS.accountType)),
  ]);

  return {
    completed: completed === 'true',
    accountType: parseAccountType(accountType),
  };
}

export async function completeOnboarding(accountType: AccountType): Promise<void> {
  await Promise.all([
    setItem(key(KEYS.completed), 'true'),
    setItem(key(KEYS.accountType), accountType),
  ]);
}
