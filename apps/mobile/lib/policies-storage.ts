import AsyncStorage from '@react-native-async-storage/async-storage';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

export type ApprovalPolicy = {
  id: string;
  name: string;
  rule: string;
  enabled: boolean;
};

const BASE_KEY = 'finora.policies.v1';
const key = () => userStorageKey(BASE_KEY);
const memory = new Map<string, string>();

export const MOCK_POLICIES: ApprovalPolicy[] = [
  {
    id: 'pol-amount',
    name: 'High-value approval',
    rule: 'Amounts over 500 USD require human approval',
    enabled: true,
  },
  {
    id: 'pol-new-recipient',
    name: 'New recipient',
    rule: 'First payment to a new recipient requires approval',
    enabled: true,
  },
  {
    id: 'pol-payroll',
    name: 'Payroll always approve',
    rule: 'Every payroll run requires passcode approval',
    enabled: true,
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

export async function listPolicies(storageKey = key()): Promise<ApprovalPolicy[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_POLICIES));
    return [...MOCK_POLICIES];
  }
  try {
    const parsed = JSON.parse(raw) as ApprovalPolicy[];
    return Array.isArray(parsed) ? parsed : [...MOCK_POLICIES];
  } catch {
    return [...MOCK_POLICIES];
  }
}

export async function setPolicyEnabled(
  id: string,
  enabled: boolean,
): Promise<ApprovalPolicy | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const policies = await listPolicies(storageKey);
    const next = policies.map((p) => (p.id === id ? { ...p, enabled } : p));
    await setItem(storageKey, JSON.stringify(next));
    return next.find((p) => p.id === id) ?? null;
  });
}

export function simulatePolicy(
  policies: ApprovalPolicy[],
  amountUsd: number,
  isNewRecipient: boolean,
) {
  const active = policies.filter((p) => p.enabled);
  const hits: string[] = [];
  if (active.some((p) => p.id === 'pol-amount') && amountUsd > 500) {
    hits.push('High-value approval');
  }
  if (active.some((p) => p.id === 'pol-new-recipient') && isNewRecipient) {
    hits.push('New recipient');
  }
  return {
    requiresApproval: hits.length > 0 || active.some((p) => p.id === 'pol-payroll'),
    matched: hits,
  };
}

export async function clearPolicies(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
