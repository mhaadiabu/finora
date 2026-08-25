import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MOCK_APPROVALS,
  type ApprovalRequest,
  type ApprovalStatus,
} from '@/components/approvals/types';

import { userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

const BASE_KEY = 'finora.approvals.v2';
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
  memory.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Still valid for this process via memory.
  }
}

export async function listApprovals(): Promise<ApprovalRequest[]> {
  const raw = await getItem(key());
  if (!raw) {
    await setItem(key(), JSON.stringify(MOCK_APPROVALS));
    return [...MOCK_APPROVALS];
  }
  try {
    const parsed = JSON.parse(raw) as ApprovalRequest[];
    return Array.isArray(parsed) ? parsed : [...MOCK_APPROVALS];
  } catch {
    return [...MOCK_APPROVALS];
  }
}

export async function getApproval(id: string): Promise<ApprovalRequest | null> {
  const items = await listApprovals();
  return items.find((a) => a.id === id) ?? null;
}

export async function countPendingApprovals(): Promise<number> {
  const items = await listApprovals();
  return items.filter((a) => a.status === 'pending').length;
}

export async function updateApproval(
  id: string,
  patch: Partial<Pick<ApprovalRequest, 'status' | 'resolvedAt' | 'transactionId'>>,
): Promise<ApprovalRequest | null> {
  return serializeStorageMutation(key(), async () => {
    const items = await listApprovals();
    const idx = items.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    const next: ApprovalRequest = { ...items[idx]!, ...patch };
    await setItem(key(), JSON.stringify(items.map((a, i) => (i === idx ? next : a))));
    return next;
  });
}

export async function resolveApproval(
  id: string,
  status: Extract<ApprovalStatus, 'approved' | 'rejected'>,
  transactionId?: string,
): Promise<ApprovalRequest | null> {
  return updateApproval(id, {
    status,
    resolvedAt: new Date().toISOString(),
    transactionId,
  });
}

export async function clearApprovals(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
