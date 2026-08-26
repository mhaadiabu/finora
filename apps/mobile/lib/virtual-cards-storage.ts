import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';

import {
  MOCK_VIRTUAL_CARDS,
  type CreateVirtualCardInput,
  type VirtualCard,
  type VirtualCardNetwork,
  type VirtualCardStatus,
} from '@/components/cards/types';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

const BASE_KEY = 'finora.virtual-cards.v1';
const BASE_UNREAD_KEY = 'finora.virtual-cards.unread.v1';
const key = () => userStorageKey(BASE_KEY);
const unreadKey = () => userStorageKey(BASE_UNREAD_KEY);

const memory = new Map<string, string>();
const listeners = new Set<() => void>();
const issuanceListeners = new Set<(card: VirtualCard) => void>();

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

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeVirtualCards(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeVirtualCardIssuance(listener: (card: VirtualCard) => void): () => void {
  issuanceListeners.add(listener);
  return () => issuanceListeners.delete(listener);
}

export async function hasUnreadVirtualCards(): Promise<boolean> {
  return (await getItem(unreadKey())) === '1';
}

export async function clearUnreadVirtualCards(storageKey = unreadKey()): Promise<void> {
  if ((await getItem(storageKey)) !== '1') return;
  await setItem(storageKey, '0');
  notify();
}

async function publishIssuance(card: VirtualCard) {
  if (AppState.currentState === 'active') {
    issuanceListeners.forEach((listener) => listener(card));
    return;
  }
  await setItem(unreadKey(), '1');
  notify();
}

async function persist(storageKey: string, cards: VirtualCard[]) {
  await setItem(storageKey, JSON.stringify(cards));
  notify();
  return cards;
}

function randomDigits(n: number) {
  let out = '';
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

function mockPan(network: VirtualCardNetwork) {
  const prefix = network === 'mastercard' ? '555555' : '424242';
  const body = randomDigits(10);
  return `${prefix}${body}`.slice(0, 16);
}

function mockExpiry() {
  const year = (new Date().getFullYear() % 100) + 3;
  const month = String((new Date().getMonth() % 12) + 1).padStart(2, '0');
  return `${month}/${String(year).padStart(2, '0')}`;
}

export async function listVirtualCards(storageKey = key()): Promise<VirtualCard[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_VIRTUAL_CARDS));
    return [...MOCK_VIRTUAL_CARDS];
  }
  try {
    const parsed = JSON.parse(raw) as VirtualCard[];
    return Array.isArray(parsed) ? parsed : [...MOCK_VIRTUAL_CARDS];
  } catch {
    return [...MOCK_VIRTUAL_CARDS];
  }
}

export async function getVirtualCard(id: string): Promise<VirtualCard | null> {
  const cards = await listVirtualCards();
  return cards.find((c) => c.id === id) ?? null;
}

export async function findVirtualCardByLabel(query: string): Promise<VirtualCard | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const cards = await listVirtualCards();
  return (
    cards.find((c) => c.label.toLowerCase() === q) ??
    cards.find((c) => c.label.toLowerCase().includes(q)) ??
    null
  );
}

export async function createVirtualCard(input: CreateVirtualCardInput): Promise<VirtualCard> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const cards = await listVirtualCards(storageKey);
    const network = input.network ?? (Math.random() > 0.5 ? 'visa' : 'mastercard');
    const pan = mockPan(network);
    const card: VirtualCard = {
      id: `card_${Crypto.randomUUID()}`,
      label: input.label.trim() || 'Virtual card',
      last4: pan.slice(-4),
      network,
      currency: input.currency ?? 'USD',
      status: 'active',
      spendLimit: input.spendLimit,
      spent: 0,
      createdAt: new Date().toISOString(),
      pan,
      expiry: mockExpiry(),
      cvv: randomDigits(3),
    };
    await persist(storageKey, [card, ...cards]);
    await publishIssuance(card);
    return card;
  });
}

export async function updateVirtualCard(
  id: string,
  patch: Partial<Pick<VirtualCard, 'status' | 'spendLimit' | 'label' | 'spent'>>,
): Promise<VirtualCard | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const cards = await listVirtualCards(storageKey);
    const idx = cards.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    const next: VirtualCard = { ...cards[idx]!, ...patch };
    await persist(
      storageKey,
      cards.map((c, i) => (i === idx ? next : c)),
    );
    return next;
  });
}

export async function setVirtualCardStatus(
  id: string,
  status: VirtualCardStatus,
): Promise<VirtualCard | null> {
  return updateVirtualCard(id, { status });
}

export async function clearVirtualCards(): Promise<void> {
  const cardsKey = key();
  const unreadStorageKey = unreadKey();
  await persist(cardsKey, []);
  await clearUnreadVirtualCards(unreadStorageKey);
}
