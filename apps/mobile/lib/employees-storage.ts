import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

export type PayoutDestination = {
  kind: 'bank_account' | 'mobile_money';
  label: string;
  value: string;
  /** WeWire beneficiary account id when live rails are wired */
  beneficiaryAccountId?: string;
  rail?: 'FPS' | 'SEPA' | 'ACH' | 'WIRE' | 'SWIFT' | 'MOMO';
};

export type Employee = {
  id: string;
  name: string;
  role: string;
  salary: number;
  currency: string;
  destination: PayoutDestination;
  status: 'active' | 'inactive';
};

const BASE_KEY = 'finora.employees.v1';
const BASE_RUN_KEY = 'finora.payroll-runs.v1';
const key = () => userStorageKey(BASE_KEY);
const runKey = () => userStorageKey(BASE_RUN_KEY);
const memory = new Map<string, string>();

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: 'Ama Boateng',
    role: 'Designer',
    salary: 2500,
    currency: 'USD',
    destination: {
      kind: 'bank_account',
      label: 'Chase · ACH',
      value: '•••• 4412',
      beneficiaryAccountId: 'ba_emp_ama_001',
      rail: 'ACH',
    },
    status: 'active',
  },
  {
    id: 'emp-2',
    name: 'Kwame Mensah',
    role: 'Engineer',
    salary: 3200,
    currency: 'USD',
    destination: {
      kind: 'bank_account',
      label: 'Wise · ACH',
      value: '•••• 8821',
      beneficiaryAccountId: 'ba_emp_kwame_001',
      rail: 'ACH',
    },
    status: 'active',
  },
];

export type PayrollRun = {
  id: string;
  period: string;
  total: number;
  currency: string;
  employeeIds: string[];
  transactionId: string;
  createdAt: string;
};

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

export async function listEmployees(storageKey = key()): Promise<Employee[]> {
  const raw = await getItem(storageKey);
  if (!raw) {
    await setItem(storageKey, JSON.stringify(MOCK_EMPLOYEES));
    return [...MOCK_EMPLOYEES];
  }
  try {
    const parsed = JSON.parse(raw) as Employee[];
    return Array.isArray(parsed) ? parsed : [...MOCK_EMPLOYEES];
  } catch {
    return [...MOCK_EMPLOYEES];
  }
}

export async function listActiveEmployees(): Promise<Employee[]> {
  const employees = await listEmployees();
  return employees.filter((e) => e.status === 'active');
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const employees = await listEmployees();
  return employees.find((e) => e.id === id) ?? null;
}

export async function findEmployeeByName(query: string): Promise<Employee | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const employees = await listEmployees();
  return (
    employees.find((e) => e.name.toLowerCase() === q) ??
    employees.find((e) => e.name.toLowerCase().includes(q)) ??
    null
  );
}

export async function createEmployee(
  input: Omit<Employee, 'id' | 'status'> & { status?: Employee['status'] },
): Promise<Employee> {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const employees = await listEmployees(storageKey);
    const employee: Employee = {
      ...input,
      id: `emp_${Crypto.randomUUID()}`,
      status: input.status ?? 'active',
    };
    await setItem(storageKey, JSON.stringify([employee, ...employees]));
    return employee;
  });
}

export async function listPayrollRuns(storageKey = runKey()): Promise<PayrollRun[]> {
  const raw = await getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PayrollRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordPayrollRun(
  run: Omit<PayrollRun, 'id' | 'createdAt'>,
): Promise<PayrollRun> {
  const storageKey = runKey();
  return serializeStorageMutation(storageKey, async () => {
    const runs = await listPayrollRuns(storageKey);
    const next: PayrollRun = {
      ...run,
      id: `prun_${Crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    await setItem(storageKey, JSON.stringify([next, ...runs]));
    return next;
  });
}

export function defaultPayrollPeriod(date = new Date()) {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export async function clearEmployees(): Promise<void> {
  memory.delete(key());
  memory.delete(runKey());
  try {
    await AsyncStorage.multiRemove([key(), runKey()]);
  } catch {
    // ignore
  }
}
