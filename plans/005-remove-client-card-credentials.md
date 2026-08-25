# Plan 005: Remove client-side virtual-card credentials

> **Executor instructions**: Follow this plan step by step. Stop and report on
> any STOP condition. Update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat cbfb3a8..HEAD -- apps/mobile/lib/virtual-cards-storage.ts apps/mobile/components/cards`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/003-isolate-local-accounts-and-app-lock.md`
- **Category**: security
- **Planned at**: commit `cbfb3a8`, 2026-08-25

## Why this matters

The virtual-card demo persists full PAN, expiry, and CVV in AsyncStorage and
copies them to the clipboard after a local gate. Even though the docs call the
cards mock-only, this is a production-shaped data model that would expose
payment credentials through backups or device extraction.

## Current state

- `apps/mobile/lib/virtual-cards-storage.ts:123-143` writes `pan`, `expiry`,
  and `cvv` into the card JSON; `:75-85` uses `Math.random()` to generate them.
- `apps/mobile/components/cards/types.ts:6-19` includes full credential fields.
- `apps/mobile/components/cards/VirtualCardManagePanel.tsx:224-240` renders and
  copies all three values after `reveal()`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @finora/mobile check-types` | exit 0 |
| Lint | `pnpm --filter @finora/mobile lint` | exit 0 |
| Workspace check | `pnpm check` | exit 0 |

## Scope

Virtual-card types, storage, creation/request flow, manage panel, and migration
of existing demo records. Do not implement card-provider rails in this plan.

## Steps

### Step 1: Redesign the persisted card record

Persist only label, last four, network, currency, status, spend limit, spent,
and timestamps. Make full credential fields impossible to serialize in the
storage type. Quarantine or delete existing plaintext records during migration.

**Verify**: a storage grep finds no persisted `pan`, `cvv`, or full `expiry`.

### Step 2: Add a secure reveal contract

For live/provider mode, fetch a short-lived reveal payload from an authenticated
server endpoint after the platform challenge. Hold secrets in memory only,
expire them after the existing timeout, clear clipboard where the platform
allows it, and never log them. For local demo mode, use clearly labeled fixture
data that is not saved as a card credential.

**Verify**: reveal timeout clears state and copy is unavailable after expiry.

### Step 3: Remove insecure generation

Delete `Math.random()` card-secret generation from the persisted path. If the
demo still needs illustrative values, derive deterministic masked fixtures or
use `expo-crypto` only for non-sensitive IDs, never as a substitute for a card
vault.

**Verify**: no card credential is generated or persisted by the mobile store.

## Test plan

Add focused storage and manage-panel tests for migration, masked rendering,
reveal expiry, copy behavior, and cancelled/frozen cards. Follow existing mobile
test conventions if present; otherwise keep tests at the pure storage/parser
boundary and use manual device verification for clipboard behavior.

## Done criteria

- [ ] Existing plaintext card records are migrated or removed.
- [ ] Persisted card data contains no PAN, CVV, or full expiry.
- [ ] Reveal is short-lived and server-authorized outside explicit demo mode.
- [ ] No secrets are logged or left in component state after timeout.
- [ ] Typecheck/lint/check pass.

## STOP conditions

- A live provider requires client-side PAN storage. Stop and escalate; do not
  preserve it in AsyncStorage.
- Existing demo data cannot be distinguished from non-demo credentials.

## Maintenance notes

Review card UI changes with storage changes. “Mock-only” is not a reason to
normalize plaintext credential storage.
