import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';
import type { SupportedCurrency } from '@/components/ui/currency-icon';

import {
  MOCK_TRANSACTIONS,
  buildTransactionTimeline,
  currencySymbol,
  type Transaction,
  type TransactionStatus,
} from '@/components/activity/types';

import { userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

const BASE_KEY = 'finora.transactions.v1';
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

export async function listTransactions(): Promise<Transaction[]> {
  const raw = await getItem(key());
  if (!raw) {
    await setItem(key(), JSON.stringify(MOCK_TRANSACTIONS));
    return [...MOCK_TRANSACTIONS];
  }
  try {
    const parsed = JSON.parse(raw) as Transaction[];
    return Array.isArray(parsed) ? parsed : [...MOCK_TRANSACTIONS];
  } catch {
    return [...MOCK_TRANSACTIONS];
  }
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const txs = await listTransactions();
  return txs.find((t) => t.id === id || t.wewireId === id) ?? null;
}

export async function upsertTransaction(tx: Transaction): Promise<Transaction> {
  return serializeStorageMutation(key(), async () => {
    const txs = await listTransactions();
    const idx = txs.findIndex(
      (item) => item.id === tx.id || (tx.wewireId && item.wewireId === tx.wewireId),
    );
    if (idx >= 0 && txs[idx]?.wewireId === tx.wewireId) return txs[idx]!;
    const next = idx >= 0 ? txs.map((item, i) => (i === idx ? tx : item)) : [tx, ...txs];
    await setItem(key(), JSON.stringify(next));
    return tx;
  });
}

export async function recordSentPayment(input: {
  payment: PaymentConfirmation;
  transactionId: string;
  source?: Transaction['source'];
  status?: TransactionStatus;
}): Promise<Transaction> {
  const { payment, transactionId } = input;
  const status = input.status ?? 'completed';
  const now = new Date().toISOString();
  const currency = (payment.currency as SupportedCurrency) || 'USD';

  const existing = await getTransaction(transactionId);
  if (existing) return existing;

  const tx: Transaction = {
    id: `tx-${Crypto.randomUUID()}`,
    direction: 'sent',
    status,
    currency,
    amount: payment.amount,
    symbol: currencySymbol(currency),
    counterparty: payment.recipientName,
    method: payment.destination.label,
    timestamp: now,
    wewireId: transactionId,
    finoraId: `fin_${Crypto.randomUUID()}`,
    rail: payment.destination.label,
    reference: payment.reference,
    source: input.source ?? 'chat',
    destinationValue: payment.destination.value,
    timeline: buildTransactionTimeline(status, now),
  };

  await upsertTransaction(tx);
  return tx;
}

/** Record an inbound funding credit (VA / MoMo / crypto / MoMo pull). */
export async function recordReceivedFunding(input: {
  amount: number;
  currency: string;
  method: string;
  counterparty?: string;
  transactionId: string;
  reference?: string;
  source?: Transaction['source'];
}): Promise<Transaction> {
  const existing = await getTransaction(input.transactionId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const currency = (input.currency as SupportedCurrency) || 'USD';
  const tx: Transaction = {
    id: `tx-${Crypto.randomUUID()}`,
    direction: 'received',
    status: 'completed',
    currency,
    amount: input.amount,
    symbol: currencySymbol(currency),
    counterparty: input.counterparty ?? 'Inbound funding',
    method: input.method,
    timestamp: now,
    wewireId: input.transactionId,
    finoraId: `fin_${Crypto.randomUUID()}`,
    rail: input.method,
    reference: input.reference,
    source: input.source ?? 'chat',
    timeline: buildTransactionTimeline('completed', now),
  };

  await upsertTransaction(tx);
  return tx;
}

export async function clearTransactions(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
