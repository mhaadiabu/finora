import AsyncStorage from '@react-native-async-storage/async-storage';

let activeUserId: string | null = null;
const blockedUserIds = new Set<string>();

const USER_DATA_KEYS = [
  'finora.auth.tagConfigured',
  'finora.auth.tagConfiguredUserId',
  'finora.onboarding.completed',
  'finora.accountType',
  'finora.passcode.hash',
  'finora.passcode.verifier.v2',
  'finora.contacts.v2',
  'finora.approvals.v2',
  'finora.transactions.v1',
  'finora.invoices.v1',
  'finora.calendar-events.v1',
  'finora.sms-requests.v1',
  'finora.employees.v1',
  'finora.payroll-runs.v1',
  'finora.suppliers.v1',
  'finora.beneficiaries.v1',
  'finora.policies.v1',
  'finora.automations.v1',
  'finora.expenses.v1',
  'finora.recurring.v1',
  'finora.integrations.v1',
  'finora.settings.v1',
  'finora.memories.v1',
  'finora.finora-tags.recent.v1',
  'finora.virtual-cards.v1',
  'finora.virtual-cards.unread.v1',
  'finora:local-threads:v1',
] as const;

function encodeUserId(userId: string) {
  return encodeURIComponent(userId);
}

export function getActiveUserId() {
  return activeUserId;
}

export function userStorageKey(baseKey: string, userId = activeUserId) {
  return `${baseKey}.user.${userId ? encodeUserId(userId) : 'signed-out'}`;
}

export function isUserStorageKeyWritable(storageKey: string) {
  const suffix = activeUserId ? `.user.${encodeUserId(activeUserId)}` : '.user.signed-out';
  return Boolean(activeUserId && !blockedUserIds.has(activeUserId) && storageKey.endsWith(suffix));
}

/** Stop writes started by the current account before its local data is removed. */
export function blockActiveUserStorageWrites() {
  if (activeUserId) blockedUserIds.add(activeUserId);
}

/** Set the Clerk user used to scope device-local financial data. */
export async function setActiveUserId(userId: string | null) {
  activeUserId = userId;
  if (!userId) return;
  blockedUserIds.delete(userId);

  // Old releases used global keys. Quarantine them instead of assigning one
  // account's financial data to whichever user signs in first.
  const legacy = await AsyncStorage.multiGet([...USER_DATA_KEYS]).catch(() => []);
  const present = legacy.filter(([, value]) => value !== null);
  if (present.length === 0) return;
  try {
    await AsyncStorage.multiSet(
      present.map(([key, value]) => [`finora.legacy.quarantine.${key}`, value!]),
    );
  } catch {
    return;
  }
  await AsyncStorage.multiRemove(present.map(([key]) => key)).catch(() => undefined);
}

export async function clearActiveUserStorage() {
  const userId = activeUserId;
  const suffix = `.user.${userId ? encodeUserId(userId) : 'signed-out'}`;
  const allKeys = await AsyncStorage.getAllKeys().catch(() => []);
  const keys = [
    ...USER_DATA_KEYS.map((baseKey) => userStorageKey(baseKey, userId)),
    ...allKeys.filter(
      (key) => key.endsWith(suffix) || (userId && key === `finora:remote-threads:${userId}`),
    ),
  ];
  await AsyncStorage.multiRemove(keys).catch(() => undefined);
  activeUserId = null;
}
