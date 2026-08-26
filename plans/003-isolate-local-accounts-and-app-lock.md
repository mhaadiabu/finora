# Plan 003: Isolate local accounts and harden the app lock

> **Executor instructions**: Follow this plan step by step. Stop and report if
> a STOP condition occurs. Update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat cbfb3a8..HEAD -- apps/mobile/lib apps/mobile/app apps/mobile/components`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/001-restore-mobile-verification-baseline.md`
- **Category**: security / correctness
- **Planned at**: commit `cbfb3a8`, 2026-08-25

## Why this matters

Sign-out only ends the Clerk session. It does not clear or namespace local
financial state. A second account on the same device can inherit approvals,
contacts, transactions, cards, settings, and chat metadata. The app also never
calls the exposed `PasscodeGate.lock()` when backgrounded, so one unlock lasts
through the next foreground visit.

## Current state

- `apps/mobile/app/(app)/settings/index.tsx:69-80` and
  `settings/account.tsx:53-64` call `signOut()` without local cleanup.
- Global keys include `transactions-storage.ts:14`, `approvals-storage.ts:9`,
  `contacts-storage.ts:6`, `virtual-cards-storage.ts:12`,
  `settings-storage.ts:5`, and `local-thread-adapter.ts:9`.
- `apps/mobile/lib/reset-session.ts:49-75` is an explicit developer/user reset,
  not part of ordinary sign-out.
- `apps/mobile/lib/passcode-gate.tsx:25-40` exposes `lock`, but
  `apps/mobile/app/_layout.tsx:131-146` only reads the in-memory flag.
- `AppSwitcherPrivacy` covers screenshots only; it does not lock live content.
- `passcode-storage.ts:34-42` uses a 32-bit unsalted FNV-like hash in
  AsyncStorage, and `:8-22` falls back to process memory.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @finora/mobile check-types` | exit 0 |
| Lint | `pnpm --filter @finora/mobile lint` | exit 0 |
| Workspace check | `pnpm check` | exit 0 |

## Scope

All user-owned mobile stores under `apps/mobile/lib/*-storage.ts`, auth/reset
flows, passcode storage/gate, root lifecycle, and settings sign-out screens.
Do not touch API auth or Clerk configuration unless the existing contract makes
the migration impossible.

## Steps

### Step 1: Establish the account namespace

Create one key helper that requires the current Clerk user ID for user-owned
data. Migrate existing global keys once, then prevent reads from the old keys.
Include thread caches, active stream IDs, pending payment links, recent tags,
virtual cards, approvals, and remote invoice cache.

**Verify**: a storage test with two user IDs shows disjoint values and the old
global keys are removed or quarantined.

### Step 2: Make sign-out a privacy boundary

Before mounting auth screens for the next account, clear the previous user's
in-memory caches and sensitive device data. Keep non-sensitive onboarding
preferences only if product explicitly wants them. Ensure both settings sign-out
entry points use the same cleanup function.

**Verify**: sign in as user A, create local data, sign out, sign in as user B;
no A data or passcode appears. Repeat with a cold app restart.

### Step 3: Replace the toy passcode verifier

Use platform-protected storage for device-bound verifier material. Use a
versioned migration that forces reset rather than accepting the legacy 32-bit
hash indefinitely. Fail closed for approval when protected storage is
unavailable. Keep server-bound approval challenges as the authorization source
for remote money actions.

**Verify**: legacy verifier migration, unavailable SecureStore, wrong PIN, and
successful reset cases all have explicit outcomes.

### Step 4: Relock on lifecycle transitions

Subscribe to `AppState` in the root auth boundary and call `lock()` on inactive
or background. Define a short documented grace period only if needed for an
interrupting system sheet. Keep protected content covered until the gate is
unlocked again.

**Verify**: background/resume requires re-auth; switching apps during payment
approval does not expose the protected screen.

### Step 5: Serialize local mutations and use UUIDs

Centralize read-modify-write mutations behind a per-store queue. Make payment
records idempotent by preparation/transaction ID and replace `Date.now()` IDs
with `expo-crypto` UUIDs. Apply the helper to transactions, approvals, cards,
employees, and other stores touched concurrently by tool UIs.

**Verify**: concurrent writes retain all records and repeated completion creates
one record.

## Done criteria

- [ ] User-owned storage is namespaced and old global keys are migrated/removed.
- [ ] Ordinary sign-out clears or quarantines the previous account's sensitive data.
- [ ] Backgrounding relocks protected content.
- [ ] Legacy passcode verifier is not accepted as a permanent authorization path.
- [ ] Concurrent local mutations are serialized and idempotent.
- [ ] Mobile typecheck/lint/check pass.

## STOP conditions

- Clerk can return no stable user ID during a signed-in storage operation.
- Product requires offline recovery of the legacy passcode without a secure
  migration choice.
- A cleanup would delete server-backed data rather than device-local cache.

## Maintenance notes

New local stores must use the namespace and mutation helper. Review sign-out,
account switching, and background lifecycle behavior together.
