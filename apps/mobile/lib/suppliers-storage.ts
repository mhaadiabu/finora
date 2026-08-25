import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PayoutDestination } from '@/lib/employees-storage';

import { userStorageKey } from './session-storage';

export type Supplier = {
  id: string;
  name: string;
  currency: string;
  defaultAmount?: number;
  destination: PayoutDestination;
  notes?: string;
};

const BASE_KEY = 'finora.suppliers.v1';
const key = () => userStorageKey(BASE_KEY);
const memory = new Map<string, string>();

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'TechFlow Ltd',
    currency: 'GBP',
    defaultAmount: 780,
    destination: {
      kind: 'bank_account',
      label: 'Barclays · FPS',
      value: '•••• 0194',
      beneficiaryAccountId: 'ba_sup_techflow_001',
      rail: 'FPS',
    },
    notes: 'Engineering contractor',
  },
  {
    id: 'sup-2',
    name: 'ClearView Partners',
    currency: 'GBP',
    defaultAmount: 1500,
    destination: {
      kind: 'bank_account',
      label: 'HSBC · FPS',
      value: '•••• 7731',
      beneficiaryAccountId: 'ba_sup_clearview_001',
      rail: 'FPS',
    },
    notes: 'Advisory retainer',
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
  memory.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // memory fallback
  }
}

export async function listSuppliers(): Promise<Supplier[]> {
  const raw = await getItem(key());
  if (!raw) {
    await setItem(key(), JSON.stringify(MOCK_SUPPLIERS));
    return [...MOCK_SUPPLIERS];
  }
  try {
    const parsed = JSON.parse(raw) as Supplier[];
    return Array.isArray(parsed) ? parsed : [...MOCK_SUPPLIERS];
  } catch {
    return [...MOCK_SUPPLIERS];
  }
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const suppliers = await listSuppliers();
  return suppliers.find((s) => s.id === id) ?? null;
}

export async function findSupplierByName(query: string): Promise<Supplier | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const suppliers = await listSuppliers();
  return (
    suppliers.find((s) => s.name.toLowerCase() === q) ??
    suppliers.find((s) => s.name.toLowerCase().includes(q)) ??
    suppliers.find((s) => q.includes(s.name.toLowerCase().split(/\s+/)[0] ?? '')) ??
    null
  );
}

export async function clearSuppliers(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
