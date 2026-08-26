import AsyncStorage from '@react-native-async-storage/async-storage';

import { MOCK_INVOICES, type Invoice, type InvoiceStatus } from '@/components/invoices/types';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

const BASE_KEY = 'finora.invoices.v1';
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
    // memory fallback
  }
}

export async function listInvoices(storageKey = key()): Promise<Invoice[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_INVOICES));
    return [...MOCK_INVOICES];
  }
  try {
    const parsed = JSON.parse(raw) as Invoice[];
    return Array.isArray(parsed) ? parsed : [...MOCK_INVOICES];
  } catch {
    return [...MOCK_INVOICES];
  }
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const items = await listInvoices();
  return items.find((i) => i.id === id) ?? null;
}

export async function listDueInvoices(): Promise<Invoice[]> {
  const items = await listInvoices();
  return items.filter((i) => i.status === 'due');
}

export async function updateInvoice(
  id: string,
  patch: Partial<Pick<Invoice, 'status' | 'paidAt' | 'transactionId'>>,
): Promise<Invoice | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const items = await listInvoices(storageKey);
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const next: Invoice = { ...items[idx]!, ...patch };
    await setItem(storageKey, JSON.stringify(items.map((i, n) => (n === idx ? next : i))));
    return next;
  });
}

export async function markInvoicePaid(id: string, transactionId: string): Promise<Invoice | null> {
  return updateInvoice(id, {
    status: 'paid' satisfies InvoiceStatus,
    paidAt: new Date().toISOString(),
    transactionId,
  });
}

export async function dismissInvoice(id: string): Promise<Invoice | null> {
  return updateInvoice(id, { status: 'dismissed' });
}

export async function clearInvoices(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
