import AsyncStorage from '@react-native-async-storage/async-storage';

import { setAccountType } from '@/lib/account';
import { clearApprovals } from '@/lib/approvals-storage';
import { clearAutomations } from '@/lib/automations-storage';
import { clearBeneficiaries } from '@/lib/beneficiaries-storage';
import { clearCalendarEvents } from '@/lib/calendar-events-storage';
import { clearContacts } from '@/lib/contacts-storage';
import { clearEmployees } from '@/lib/employees-storage';
import { clearExpenses } from '@/lib/expenses-storage';
import { clearRecentFinoraTags } from '@/lib/finora-tags';
import { clearIntegrations } from '@/lib/integrations-storage';
import { clearInvoices } from '@/lib/invoices-storage';
import { clearMemoryStore } from '@/lib/memory-storage';
import { clearPasscode } from '@/lib/passcode-storage';
import { clearPolicies } from '@/lib/policies-storage';
import { clearRecurring } from '@/lib/recurring-storage';
import { clearSettings } from '@/lib/settings-storage';
import { clearSmsRequests } from '@/lib/sms-requests-storage';
import { clearSuppliers } from '@/lib/suppliers-storage';
import { clearTransactions } from '@/lib/transactions-storage';

import { clearActiveUserStorage } from './session-storage';

const KEYS = [
  'finora.auth.tagConfigured',
  'finora.auth.tagConfiguredUserId',
  'finora.onboarding.completed',
  'finora.accountType',
  'finora.passcode.hash',
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
] as const;

/** Clears auth + onboarding + passcode + local demo persistence. */
export async function resetFinoraSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...KEYS]);
  } catch {
    // Native module may be unavailable; in-memory maps in storage helpers won't clear
    // across modules, but next boot with working AsyncStorage will read empty.
  }
  await clearPasscode();
  await clearContacts();
  await clearRecentFinoraTags();
  await clearApprovals();
  await clearTransactions();
  await clearInvoices();
  await clearCalendarEvents();
  await clearSmsRequests();
  await clearEmployees();
  await clearSuppliers();
  await clearBeneficiaries();
  await clearPolicies();
  await clearAutomations();
  await clearExpenses();
  await clearRecurring();
  await clearIntegrations();
  await clearSettings();
  await clearMemoryStore();
  setAccountType('personal');
  await clearActiveUserStorage();
}
