import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { SupportedCurrency } from '@/components/ui/currency-icon';

import { MOCK_CONTACTS, type Contact } from '@/components/contacts/types';

import { userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';
const BASE_KEY = 'finora.contacts.v2';
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

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export async function listContacts(): Promise<Contact[]> {
  const raw = await getItem(key());
  if (!raw) {
    await setItem(key(), JSON.stringify(MOCK_CONTACTS));
    return [...MOCK_CONTACTS];
  }
  try {
    const parsed = JSON.parse(raw) as Array<Contact & { handle?: string }>;
    if (!Array.isArray(parsed)) return [...MOCK_CONTACTS];
    const cleaned = parsed
      .filter(
        (contact) =>
          !(
            contact.id === 'c-10' &&
            contact.handle === 'okenneth' &&
            contact.identifier === '+233 •• ••• 5010'
          ),
      )
      .map(({ handle: _legacyContactHandle, ...contact }) => contact);
    if (JSON.stringify(cleaned) !== raw) {
      await setItem(key(), JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [...MOCK_CONTACTS];
  }
}

export async function findContactByIdentifier(identifier: string): Promise<Contact | null> {
  const contacts = await listContacts();
  const needle = identifier.replace(/\s+/g, '').toLowerCase();
  return contacts.find((c) => c.identifier.replace(/\s+/g, '').toLowerCase() === needle) ?? null;
}

export async function saveContact(input: {
  name: string;
  currency: string;
  method: string;
  identifier: string;
  favourite?: boolean;
}): Promise<Contact> {
  return serializeStorageMutation(key(), async () => {
    const contacts = await listContacts();
    const needle = input.identifier.replace(/\s+/g, '').toLowerCase();
    const existing = contacts.find(
      (c) => c.identifier.replace(/\s+/g, '').toLowerCase() === needle,
    );
    if (existing) {
      const updated: Contact = {
        ...existing,
        name: input.name || existing.name,
        method: input.method || existing.method,
        currency: (input.currency as SupportedCurrency) || existing.currency,
        lastTxDate: new Date().toISOString(),
      };
      const next = contacts.map((c) => (c.id === existing.id ? updated : c));
      await setItem(key(), JSON.stringify(next));
      return updated;
    }

    const contact: Contact = {
      id: `c-${Crypto.randomUUID()}`,
      name: input.name.trim() || 'Contact',
      initials: initialsFromName(input.name),
      currency: (input.currency as SupportedCurrency) || 'USD',
      method: input.method,
      identifier: input.identifier,
      favourite: input.favourite ?? false,
      lastTxDate: new Date().toISOString(),
    };
    await setItem(key(), JSON.stringify([contact, ...contacts]));
    return contact;
  });
}

export async function clearContacts(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
