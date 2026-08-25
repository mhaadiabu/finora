import { FinoraTagSchema, normalizeFinoraTag, type FinoraTagAccount } from '@finora/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getApiUrl } from '@/lib/api-url';
import { getCachedSettings } from '@/lib/settings-storage';

import { userStorageKey } from './session-storage';

export type FinoraTagProfile = FinoraTagAccount & {
  initials: string;
};

export type FinoraTagSuggestion = FinoraTagProfile & {
  /** Shown only for people already in the user's Finora graph. */
  source: 'recent' | 'exact';
};

export const CURRENT_FINORA_ACCOUNT = {
  accountId: 'acct_personal_001',
  subCustomerId: 'sc_personal_001',
  tag: 'kennethowusu',
} as const;

/** Active user's Finora tag from settings (falls back to demo constant). */
export function getCurrentFinoraTag() {
  const tag = getCachedSettings().finoraTag?.trim();
  return tag ? normalizeFinoraTag(tag) : CURRENT_FINORA_ACCOUNT.tag;
}

export const FINORA_TAG_MIN_LENGTH = 3;

export type FinoraTagAvailability =
  | { ok: true; tag: string }
  | { ok: false; reason: 'invalid' | 'taken' | 'too_short' };

export function suggestFinoraTagFromName(name: string, email?: string) {
  const compact = name.trim().replace(/\s+/g, '_');
  const fromName = normalizeFinoraTag(compact);
  if (fromName.length >= FINORA_TAG_MIN_LENGTH) return fromName;

  const local = email?.split('@')[0] ?? '';
  const fromEmail = normalizeFinoraTag(local);
  if (fromEmail.length >= FINORA_TAG_MIN_LENGTH) return fromEmail;

  return fromName || fromEmail;
}

/** Prefix search against the global directory never runs below this length. */
export const FINORA_TAG_GLOBAL_MIN_CHARS = 3;
const BASE_RECENT_KEY = 'finora.finora-tags.recent.v1';
const recentKey = () => userStorageKey(BASE_RECENT_KEY);
const RECENT_LIMIT = 12;
const SUGGESTION_LIMIT = 6;
type GetToken = () => Promise<string | null>;

function profileFromAccount(account: FinoraTagAccount): FinoraTagProfile {
  return { ...account, initials: initialsFromName(account.displayName || account.tag) };
}

/** Authenticated production directory search used by the composer. */
export async function searchFinoraTagsRemote(
  query: string,
  getToken: GetToken,
  signal?: AbortSignal,
): Promise<FinoraTagSuggestion[]> {
  const needle = normalizeFinoraTag(query);
  if (needle.length < FINORA_TAG_GLOBAL_MIN_CHARS) return [];
  const apiUrl = getApiUrl();
  const token = await getToken();
  if (!apiUrl || !token) return [];

  const response = await fetch(
    `${apiUrl}/v1/finora-tags/search?query=${encodeURIComponent(needle)}`,
    {
      signal,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as { accounts?: FinoraTagAccount[] };
  return (Array.isArray(payload.accounts) ? payload.accounts : [])
    .filter((account) => account.status === 'active' && account.tag !== getCurrentFinoraTag())
    .slice(0, SUGGESTION_LIMIT)
    .map((account) => ({ ...profileFromAccount(account), source: 'exact' as const }));
}

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

const MOCK_FINORA_DIRECTORY: FinoraTagProfile[] = [
  {
    accountId: 'acct_personal_002',
    subCustomerId: 'sc_personal_002',
    tag: 'okenneth',
    displayName: 'O. Kenneth Mensah',
    initials: 'OK',
    country: 'GH',
    status: 'active',
    walletCurrencies: ['GHS', 'USD'],
  },
  {
    accountId: 'acct_personal_003',
    subCustomerId: 'sc_personal_003',
    tag: 'ama',
    displayName: 'Ama Asante',
    initials: 'AA',
    country: 'GH',
    status: 'active',
    walletCurrencies: ['GHS'],
  },
  {
    accountId: 'acct_business_002',
    subCustomerId: 'sc_business_002',
    tag: 'acmegh',
    displayName: 'Acme Ghana',
    initials: 'AG',
    country: 'GH',
    status: 'active',
    walletCurrencies: ['GHS', 'USD'],
  },
];

const RESERVED_FINORA_TAGS = new Set([
  CURRENT_FINORA_ACCOUNT.tag,
  'finorademo',
  ...MOCK_FINORA_DIRECTORY.map((p) => p.tag),
]);

export function checkFinoraTagAvailability(raw: string): FinoraTagAvailability {
  const tag = normalizeFinoraTag(raw);
  const current = getCurrentFinoraTag();
  if (tag.length < FINORA_TAG_MIN_LENGTH) {
    return { ok: false, reason: 'too_short' };
  }
  const parsed = FinoraTagSchema.safeParse(tag);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.data !== current && RESERVED_FINORA_TAGS.has(parsed.data)) {
    return { ok: false, reason: 'taken' };
  }
  return { ok: true, tag: parsed.data };
}

/** Register the signed-in user's tag in the mock directory for receive/lookup flows. */
export function registerCurrentUserFinoraTag(input: {
  tag: string;
  displayName: string;
  email?: string;
}) {
  const tag = normalizeFinoraTag(input.tag);
  if (!tag) return;

  const existing = MOCK_FINORA_DIRECTORY.find((profile) => profile.tag === tag);
  if (existing) {
    existing.displayName = input.displayName.trim() || tag;
    return;
  }

  MOCK_FINORA_DIRECTORY.unshift({
    accountId: CURRENT_FINORA_ACCOUNT.accountId,
    subCustomerId: CURRENT_FINORA_ACCOUNT.subCustomerId,
    tag,
    displayName: input.displayName.trim() || tag,
    initials: initialsFromName(input.displayName || tag),
    country: 'GH',
    status: 'active',
    walletCurrencies: ['GHS', 'USD'],
  });
  RESERVED_FINORA_TAGS.add(tag);
}

/** Demo seed so @ opens people you've "already paid", not the global directory. */
const SEED_RECENT_TAGS = ['okenneth', 'ama'] as const;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function matchesQuery(profile: Pick<FinoraTagProfile, 'tag' | 'displayName'>, query: string) {
  if (!query) return true;
  return profile.tag.startsWith(query) || profile.displayName.toLowerCase().includes(query);
}

/** Exact account lookup. Never falls back to saved contacts. */
export async function lookupFinoraTag(value: string) {
  const tag = normalizeFinoraTag(value);
  if (!tag || tag === getCurrentFinoraTag()) return null;
  return MOCK_FINORA_DIRECTORY.find((profile) => profile.tag === tag) ?? null;
}

export async function listRecentFinoraTags(): Promise<FinoraTagSuggestion[]> {
  const raw = await getItem(recentKey());
  let tags: string[] = [];
  if (!raw) {
    tags = [...SEED_RECENT_TAGS];
    await setItem(recentKey(), JSON.stringify(tags));
  } else {
    try {
      const parsed = JSON.parse(raw) as string[];
      tags = Array.isArray(parsed) ? parsed.map(normalizeFinoraTag).filter(Boolean) : [];
    } catch {
      tags = [...SEED_RECENT_TAGS];
    }
  }

  const profiles: FinoraTagSuggestion[] = [];
  for (const tag of tags) {
    if (tag === getCurrentFinoraTag()) continue;
    const profile = await lookupFinoraTag(tag);
    if (!profile || profile.status !== 'active') continue;
    profiles.push({ ...profile, source: 'recent' });
  }
  return profiles;
}

export async function rememberFinoraTagRecipient(input: {
  tag: string;
  displayName?: string;
  subCustomerId?: string;
  accountId?: string;
  walletCurrencies?: string[];
  country?: string;
}): Promise<void> {
  const tag = normalizeFinoraTag(input.tag);
  if (!tag || tag === getCurrentFinoraTag()) return;

  // Keep the mock directory in sync for people we only learned via a transfer.
  if (!(await lookupFinoraTag(tag))) {
    MOCK_FINORA_DIRECTORY.unshift({
      accountId: input.accountId ?? `acct_${tag}`,
      subCustomerId: input.subCustomerId ?? `sc_${tag}`,
      tag,
      displayName: input.displayName?.trim() || tag,
      initials: initialsFromName(input.displayName || tag),
      country: input.country ?? 'GH',
      status: 'active',
      walletCurrencies: input.walletCurrencies?.length ? input.walletCurrencies : ['GHS'],
    });
  }

  const recent = await listRecentFinoraTags();
  const next = [tag, ...recent.map((item) => item.tag).filter((item) => item !== tag)].slice(
    0,
    RECENT_LIMIT,
  );
  await setItem(recentKey(), JSON.stringify(next));
}

/**
 * Autocomplete source for the composer.
 *
 * - `@` / short prefixes: only people already in the user's recent Finora graph
 * - 3+ chars: recent matches, plus an exact global hit if the full tag exists
 * - Never returns a global prefix dump of the platform directory
 */
export async function searchFinoraTags(query: string): Promise<FinoraTagSuggestion[]> {
  const needle = normalizeFinoraTag(query);
  const recent = await listRecentFinoraTags();
  const recentMatches = recent
    .filter((profile) => matchesQuery(profile, needle))
    .slice(0, SUGGESTION_LIMIT);

  if (needle.length < FINORA_TAG_GLOBAL_MIN_CHARS) {
    return recentMatches;
  }

  const exact = await lookupFinoraTag(needle);
  if (!exact || exact.status !== 'active') return recentMatches;
  if (recentMatches.some((profile) => profile.tag === exact.tag)) return recentMatches;

  const exactSuggestion: FinoraTagSuggestion = { ...exact, source: 'exact' };
  return [exactSuggestion, ...recentMatches].slice(0, SUGGESTION_LIMIT);
}

export async function clearRecentFinoraTags(): Promise<void> {
  memory.delete(recentKey());
  try {
    await AsyncStorage.removeItem(recentKey());
  } catch {
    // ignore
  }
}
