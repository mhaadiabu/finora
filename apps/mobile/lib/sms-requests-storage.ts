import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isUserStorageKeyWritable,
  isUserStorageOperationBlocked,
  userStorageKey,
} from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

export type SmsPaymentRequest = {
  id: string;
  fromName: string;
  fromPhone: string;
  body: string;
  receivedAt: string;
  amount?: number;
  currency?: string;
  network?: string;
  status: 'new' | 'paid' | 'dismissed';
  transactionId?: string;
};

const BASE_KEY = 'finora.sms-requests.v1';
const key = () => userStorageKey(BASE_KEY);
const memory = new Map<string, string>();

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const MOCK_SMS_REQUESTS: SmsPaymentRequest[] = [
  {
    id: 'sms-1',
    fromName: 'Kwame Mensah',
    fromPhone: '+233 24 555 0192',
    body: 'MTN MoMo: Payment request of GHS 200.00 from Kwame Mensah. Reply PAY to approve.',
    receivedAt: hoursAgo(3),
    amount: 200,
    currency: 'GHS',
    network: 'MTN MoMo',
    status: 'new',
  },
  {
    id: 'sms-2',
    fromName: 'Abena Owusu',
    fromPhone: '+233 20 441 8821',
    body: 'Hi, can you send 50 cedis for the supplies? MoMo 0244418821.',
    receivedAt: hoursAgo(18),
    amount: 50,
    currency: 'GHS',
    network: 'MTN MoMo',
    status: 'new',
  },
  {
    id: 'sms-3',
    fromName: 'TechFlow Ops',
    fromPhone: '+44 7700 900123',
    body: 'Reminder: GBP 180 contractor fee due. Sort code 04-00-04 · ****0194',
    receivedAt: hoursAgo(40),
    amount: 180,
    currency: 'GBP',
    network: 'Bank transfer',
    status: 'new',
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

export async function listSmsPaymentRequests(storageKey = key()): Promise<SmsPaymentRequest[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_SMS_REQUESTS));
    return [...MOCK_SMS_REQUESTS];
  }
  try {
    const parsed = JSON.parse(raw) as SmsPaymentRequest[];
    return Array.isArray(parsed) ? parsed : [...MOCK_SMS_REQUESTS];
  } catch {
    return [...MOCK_SMS_REQUESTS];
  }
}

export async function listOpenSmsPaymentRequests(): Promise<SmsPaymentRequest[]> {
  const requests = await listSmsPaymentRequests();
  return requests
    .filter((request) => request.status === 'new')
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function markSmsRequestPaid(
  id: string,
  transactionId: string,
): Promise<SmsPaymentRequest | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const requests = await listSmsPaymentRequests(storageKey);
    const next = requests.map((request) =>
      request.id === id ? { ...request, status: 'paid' as const, transactionId } : request,
    );
    if (isUserStorageOperationBlocked(storageKey))
      throw new Error('Account changed during payment.');
    await setItem(storageKey, JSON.stringify(next));
    return next.find((request) => request.id === id) ?? null;
  });
}

export async function dismissSmsRequest(id: string): Promise<SmsPaymentRequest | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const requests = await listSmsPaymentRequests(storageKey);
    const next = requests.map((request) =>
      request.id === id ? { ...request, status: 'dismissed' as const } : request,
    );
    await setItem(storageKey, JSON.stringify(next));
    return next.find((request) => request.id === id) ?? null;
  });
}

export async function clearSmsRequests(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
