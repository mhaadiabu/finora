import AsyncStorage from '@react-native-async-storage/async-storage';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

export type CalendarMoneyEventKind = 'rent' | 'payroll' | 'bill' | 'subscription' | 'other';

export type CalendarMoneyEvent = {
  id: string;
  title: string;
  kind: CalendarMoneyEventKind;
  dueAt: string;
  amount?: number;
  currency?: string;
  counterparty?: string;
  notes?: string;
  status: 'upcoming' | 'paid' | 'dismissed';
  transactionId?: string;
};

const BASE_KEY = 'finora.calendar-events.v1';
const key = () => userStorageKey(BASE_KEY);
const memory = new Map<string, string>();

function daysFromNow(days: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const MOCK_CALENDAR_EVENTS: CalendarMoneyEvent[] = [
  {
    id: 'cal-1',
    title: 'Rent — East Legon',
    kind: 'rent',
    dueAt: daysFromNow(2, 10),
    amount: 2500,
    currency: 'GHS',
    counterparty: 'Ama Landlord',
    notes: 'Monthly rent · due this week',
    status: 'upcoming',
  },
  {
    id: 'cal-2',
    title: 'Payroll run',
    kind: 'payroll',
    dueAt: daysFromNow(5, 8),
    amount: 12800,
    currency: 'GHS',
    counterparty: 'Finora Demo team',
    notes: 'Bi-weekly payroll window',
    status: 'upcoming',
  },
  {
    id: 'cal-3',
    title: 'AWS invoice reminder',
    kind: 'bill',
    dueAt: daysFromNow(1, 12),
    amount: 86,
    currency: 'USD',
    counterparty: 'Amazon Web Services',
    notes: 'Calendar reminder from billing@aws',
    status: 'upcoming',
  },
  {
    id: 'cal-4',
    title: 'Netflix',
    kind: 'subscription',
    dueAt: daysFromNow(8, 7),
    amount: 15.99,
    currency: 'USD',
    counterparty: 'Netflix',
    notes: 'Subscription renewal',
    status: 'upcoming',
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

export async function listCalendarMoneyEvents(storageKey = key()): Promise<CalendarMoneyEvent[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_CALENDAR_EVENTS));
    return [...MOCK_CALENDAR_EVENTS];
  }
  try {
    const parsed = JSON.parse(raw) as CalendarMoneyEvent[];
    return Array.isArray(parsed) ? parsed : [...MOCK_CALENDAR_EVENTS];
  } catch {
    return [...MOCK_CALENDAR_EVENTS];
  }
}

export async function listUpcomingCalendarMoneyEvents(): Promise<CalendarMoneyEvent[]> {
  const events = await listCalendarMoneyEvents();
  return events
    .filter((event) => event.status === 'upcoming')
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function markCalendarEventPaid(
  id: string,
  transactionId: string,
): Promise<CalendarMoneyEvent | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const events = await listCalendarMoneyEvents(storageKey);
    const next = events.map((event) =>
      event.id === id ? { ...event, status: 'paid' as const, transactionId } : event,
    );
    await setItem(storageKey, JSON.stringify(next));
    return next.find((event) => event.id === id) ?? null;
  });
}

export async function dismissCalendarEvent(id: string): Promise<CalendarMoneyEvent | null> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const events = await listCalendarMoneyEvents(storageKey);
    const next = events.map((event) =>
      event.id === id ? { ...event, status: 'dismissed' as const } : event,
    );
    await setItem(storageKey, JSON.stringify(next));
    return next.find((event) => event.id === id) ?? null;
  });
}

export async function clearCalendarEvents(): Promise<void> {
  memory.delete(key());
  try {
    await AsyncStorage.removeItem(key());
  } catch {
    // ignore
  }
}
