import { setAccountType } from './account';
import { clearPasscode } from './passcode-storage';
import { clearPendingPaymentLink } from './pending-payment-link';
import { clearActiveUserStorage } from './session-storage';
import { clearSettings } from './settings-storage';

type SignOut = () => Promise<unknown>;

/** Remove device-local account state before ending the Clerk session. */
export async function signOutFinora(signOut: SignOut) {
  await clearPasscode();
  await clearSettings();
  clearPendingPaymentLink();
  await clearActiveUserStorage();
  setAccountType('personal');
  await signOut();
}
