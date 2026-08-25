import AsyncStorage from '@react-native-async-storage/async-storage';

import { userStorageKey } from './session-storage';

export type Beneficiary = {
  id: string;
  name: string;
  method: 'bank' | 'mobile_money' | 'crypto';
  identifier: string;
  currency: string;
  country?: string;
  verified: boolean;
  beneficiaryAccountId?: string;
  rail?: string;
};

const BASE_KEY = 'finora.beneficiaries.v1';
const key = () => userStorageKey(BASE_KEY);
const memory = new Map<string, string>();

export const MOCK_BENEFICIARIES: Beneficiary[] = [
  {
    id: 'ben-1',
    name: 'Ama Serwah',
    method: 'bank',
    identifier: '•••• 0194',
    currency: 'USD',
    country: 'US',
    verified: true,
    beneficiaryAccountId: 'ba_ben_ama_001',
    rail: 'ACH',
  },
  {
    id: 'ben-2',
    name: 'TechFlow Ltd',
    method: 'bank',
    identifier: '•••• 0194',
    currency: 'GBP',
    country: 'GB',
    verified: true,
    beneficiaryAccountId: 'ba_sup_techflow_001',
    rail: 'FPS',
  },
  {
    id: 'ben-3',
    name: 'Kofi Asante',
    method: 'mobile_money',
    identifier: '024 555 0192',
    currency: 'GHS',
    country: 'GH',
    verified: true,
    beneficiaryAccountId: 'ba_ben_kofi_001',
    rail: 'MOMO',
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

export async function listBeneficiaries(): Promise<Beneficiary[]> {
  const raw = await getItem(key());
  if (!raw) {
    await setItem(key(), JSON.stringify(MOCK_BENEFICIARIES));
    return [...MOCK_BENEFICIARIES];
  }
  try {
    const parsed = JSON.parse(raw) as Beneficiary[];
    return Array.isArray(parsed) ? parsed : [...MOCK_BENEFICIARIES];
  } catch {
    return [...MOCK_BENEFICIARIES];
  }
}

export async function clearBeneficiaries(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
