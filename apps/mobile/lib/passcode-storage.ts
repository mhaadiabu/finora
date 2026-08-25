import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { userStorageKey } from './session-storage';

const LEGACY_KEY = 'finora.passcode.hash';
const VERIFIER_KEY = 'finora.passcode.verifier.v2';
export const PASSCODE_LENGTH = 6;

type PasscodeVerifier = { version: 2; salt: string; digest: string };

async function secureStoreAvailable() {
  return SecureStore.isAvailableAsync().catch(() => false);
}

async function digestPasscode(passcode: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${passcode}`);
}

async function readVerifier() {
  if (!(await secureStoreAvailable())) return null;
  const raw = await SecureStore.getItemAsync(userStorageKey(VERIFIER_KEY)).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PasscodeVerifier>;
    return parsed.version === 2 && parsed.salt && parsed.digest
      ? (parsed as PasscodeVerifier)
      : null;
  } catch {
    return null;
  }
}

/** Legacy AsyncStorage verifiers are removed and require a new passcode. */
async function removeLegacyVerifier() {
  await AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
  await AsyncStorage.removeItem(userStorageKey(LEGACY_KEY)).catch(() => undefined);
}

export async function hasPasscode() {
  await removeLegacyVerifier();
  return Boolean(await readVerifier());
}

export async function setPasscode(passcode: string) {
  if (!/^\d{6}$/.test(passcode)) throw new Error(`Passcode must be ${PASSCODE_LENGTH} digits.`);
  if (!(await secureStoreAvailable())) throw new Error('Secure passcode storage is unavailable.');
  const salt = Crypto.randomUUID();
  const verifier: PasscodeVerifier = {
    version: 2,
    salt,
    digest: await digestPasscode(passcode, salt),
  };
  await SecureStore.setItemAsync(userStorageKey(VERIFIER_KEY), JSON.stringify(verifier), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await removeLegacyVerifier();
}

export async function verifyPasscode(passcode: string) {
  const verifier = await readVerifier();
  if (!verifier) return false;
  return verifier.digest === (await digestPasscode(passcode, verifier.salt));
}

export async function clearPasscode() {
  await SecureStore.deleteItemAsync(userStorageKey(VERIFIER_KEY)).catch(() => undefined);
  await removeLegacyVerifier();
}
