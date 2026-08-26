import AsyncStorage from '@react-native-async-storage/async-storage';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';

export type BusinessExpense = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  spentAt: string;
  cardLabel?: string;
  status: 'posted' | 'pending';
};

const BASE_KEY = 'finora.expenses.v1';
const key = () => userStorageKey(BASE_KEY);
const memory = new Map<string, string>();

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const MOCK_EXPENSES: BusinessExpense[] = [
  {
    id: 'exp-1',
    merchant: 'AWS',
    category: 'Infrastructure',
    amount: 86,
    currency: 'USD',
    spentAt: daysAgo(2),
    cardLabel: 'AWS ops',
    status: 'posted',
  },
  {
    id: 'exp-2',
    merchant: 'Notion',
    category: 'Software',
    amount: 48,
    currency: 'USD',
    spentAt: daysAgo(5),
    cardLabel: 'SaaS',
    status: 'posted',
  },
  {
    id: 'exp-3',
    merchant: 'Uber',
    category: 'Travel',
    amount: 32.5,
    currency: 'USD',
    spentAt: daysAgo(1),
    cardLabel: 'Travel',
    status: 'posted',
  },
  {
    id: 'exp-4',
    merchant: 'Figma',
    category: 'Software',
    amount: 45,
    currency: 'USD',
    spentAt: daysAgo(8),
    cardLabel: 'SaaS',
    status: 'pending',
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

export async function listExpenses(storageKey = key()): Promise<BusinessExpense[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_EXPENSES));
    return [...MOCK_EXPENSES];
  }
  try {
    const parsed = JSON.parse(raw) as BusinessExpense[];
    return Array.isArray(parsed) ? parsed : [...MOCK_EXPENSES];
  } catch {
    return [...MOCK_EXPENSES];
  }
}

export async function clearExpenses(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
