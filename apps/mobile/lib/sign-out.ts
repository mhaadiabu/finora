import { setAccountType } from './account';
import { clearPasscode } from './passcode-storage';
import { clearPendingPaymentLink } from './pending-payment-link';
import { blockActiveUserStorageWrites, clearActiveUserStorage } from './session-storage';
import { clearSettings } from './settings-storage';
import { waitForStorageMutations } from './storage-mutation';

type SignOut = () => Promise<unknown>;

/** Remove device-local account state before ending the Clerk session. */
export async function signOutFinora(signOut: SignOut) {
  blockActiveUserStorageWrites();
  await waitForStorageMutations();
  await clearPasscode();
  await clearSettings();
  clearPendingPaymentLink();
  await clearActiveUserStorage();
  setAccountType('personal');
  await signOut();
}
