# Plan 002: Bind approvals to server execution and keep demos isolated

> **Executor instructions**: Follow this plan step by step. Run every
> verification command. Stop on any STOP condition and report. Update
> `plans/README.md` when done.
>
> **Drift check**: `git diff --stat cbfb3a8..HEAD -- apps/mobile apps/api packages/shared`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/001-restore-mobile-verification-baseline.md`
- **Category**: security / correctness / architecture
- **Planned at**: commit `cbfb3a8`, 2026-08-25

## Why this matters

Remote payment, conversion, and financial-plan cards claim success after a
local PIN/biometric check, a timer, and a synthetic ID. They never call an
`execute_approved_*` API. This violates the documented
`prepare -> approval -> execute -> audit` path and can show a user “sent” or
“converted” when no platform transaction exists.

## Current state

- `apps/mobile/components/chat/PreparePaymentToolUI.tsx:125-155` waits,
  generates `WW-*` when needed, and calls `recordSentPayment`.
- `PreparePaymentToolUI.tsx:198-207` treats `requestApproval()` as enough to
  enter `sending`; `:244-249` writes `status: 'sent'` into the tool result.
- `apps/mobile/components/chat/PrepareConversionToolUI.tsx:130-149` creates a
  synthetic `FX-*` conversion after the same local delay.
- `apps/mobile/components/chat/CreateFinancialPlanToolUI.tsx:155-201` records
  a local completed transaction and says the plan executed.
- `apps/mobile/app/(app)/approval/[id].tsx:66-109` resolves local approval and
  generates a transaction ID. `apps/api/src/routes/v1.ts:684-724` is the mock
  server approval path and existing registry names include
  `execute_approved_payment`, `execute_approved_conversion`, and
  `execute_approved_financial_plan`.
- `docs/tools/mobile.md:10-12` explicitly says remote tools prepare only and
  never execute money movement.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Mobile typecheck | `pnpm --filter @finora/mobile check-types` | exit 0 |
| Mobile lint | `pnpm --filter @finora/mobile lint` | exit 0 |
| API typecheck | `pnpm --filter @finora/api check-types` | exit 0 |
| Workspace check | `pnpm check` | exit 0 |

## Scope

**In scope**: the three prepare tool UIs above, approval detail flow, mobile
API client code needed to call existing platform endpoints, shared schemas if
the response contract needs one, and focused API tests for approval idempotency.

**Out of scope**: implementing live WeWire rails, changing MCP capabilities,
rewriting the local demo adapter, or adding a new direct execution route.

## Steps

### Step 1: Define the server-bound approval contract

Use the existing preparation and approval registry names. The server response
must bind preparation ID, canonical amount/currency, destination, user, nonce or
challenge ID, expiry, and an idempotency key. Reuse existing shared Zod
conventions and the API's authenticated user context.

**Verify**: shared/API typecheck passes and a focused test rejects a missing or
expired challenge.

### Step 2: Add authenticated mobile approval/execution adapters

After local passcode/biometric success, submit the challenge to the API and
await the execution receipt. Make retries idempotent. The client must never
invent transaction IDs or treat a local timer as execution.

**Verify**: tests cover duplicate approval, stale challenge, changed amount or
recipient, server failure, and offline interruption.

### Step 3: Split remote and local demo behavior

Remote tool UIs remain `pending`, `approved`, `executing`, `completed`, or
`failed` based on server responses. Keep synthetic timers and local storage only
behind the explicit local mock adapter path. Do not display “sent” or
“converted” for a remote preparation without a server receipt.

**Verify**: grep finds no `mockTransactionId`, `mockConversionId`, or local
`recordSentPayment` in the remote execution path; local demo mode still renders
its documented flow.

### Step 4: Reconcile approvals and activity from server records

Approval detail and activity should use the server transaction ID and status.
Remove local `resolveApproval` as the authority for remote approvals; retain it
only for the explicit local demo adapter.

**Verify**: a mocked API response creates exactly one activity record with the
server ID; a failed execution creates no completed transaction.

## Test plan

Add focused API tests near the existing v1 route tests and mobile adapter tests
where the repo places them. Cover canonical payload binding, replay, duplicate
requests, and each three tool family. Follow existing Zod/API response test
patterns. Do not test timers as proof of execution.

## Done criteria

- [ ] Remote prepare cards cannot produce a completed status without an API receipt.
- [ ] No remote path generates synthetic settlement IDs.
- [ ] Approval is bound to canonical server data and idempotent.
- [ ] Existing local demo behavior is explicitly selected and documented.
- [ ] Mobile/API typecheck and lint pass.
- [ ] No files outside Scope are modified.

## STOP conditions

- The API has no authenticated execute endpoint or cannot return an immutable
  preparation payload. Stop and report the missing platform contract.
- A proposed fix would let the mobile app call WeWire directly.
- The existing mock API cannot distinguish local demo IDs from server IDs.

## Maintenance notes

Review every future money-moving tool against the same state machine. A PIN is
local user presence, not proof that the server approved a particular payload.
