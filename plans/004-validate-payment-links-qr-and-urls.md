# Plan 004: Validate payment links, QR destinations, and assistant URLs

> **Executor instructions**: Follow this plan step by step. Stop and report on
> any STOP condition. Update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat cbfb3a8..HEAD -- apps/mobile/lib apps/mobile/components/assistant-ui apps/mobile/app`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/001-restore-mobile-verification-baseline.md`
- **Category**: security
- **Planned at**: commit `cbfb3a8`, 2026-08-25

## Why this matters

The payment-link parser accepts any syntactically valid Finora payment ID even
when no request is registered, invents a default GHS amount path, and lets the
user continue. Crypto QR values get regex validation only. Assistant markdown
also opens arbitrary URL schemes. These are unsafe input boundaries before live
rails exist.

## Current state

- `apps/mobile/lib/payment-qr.ts:45-76` accepts `pay.finora.app/r/{id}` without
  authenticated request resolution; `:111-122` only parses crypto strings.
- `apps/mobile/lib/open-payment-link.ts:41-50` turns the parsed value into a
  chat prompt.
- `apps/mobile/components/assistant-ui/markdown-text.tsx:16-27` opens all
  non-HTTP URLs and externalizes all HTTP URLs.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @finora/mobile check-types` | exit 0 |
| Lint | `pnpm --filter @finora/mobile lint` | exit 0 |
| Workspace check | `pnpm check` | exit 0 |

## Scope

`apps/mobile/lib/payment-qr.ts`, `open-payment-link.ts`, pending-link/deep-link
flow, markdown link handling, and shared schemas only if required. Do not alter
the payment execution API here.

## Steps

### Step 1: Resolve payment requests from the authenticated platform

Require a server response containing canonical recipient, amount, currency,
expiry, status, and a signed or otherwise authenticated request identifier.
Reject unknown, expired, already-paid, and malformed IDs. Never prompt for a
missing amount as a substitute for a missing request.

**Verify**: parser/adapter tests reject unknown IDs and accept a valid response.

### Step 2: Validate crypto destinations by chain

Use a chain-aware validator for every supported network and bind the parsed
address to the selected network. Reject wrong-network, bad-checksum, and
ambiguous addresses before the approval card appears.

**Verify**: tests cover one valid address per supported chain plus wrong-chain,
bad-checksum, and malformed inputs.

### Step 3: Allowlist assistant links

Parse URLs with the platform URL API. Allow HTTPS links only where the host is
explicitly trusted, plus validated `finora://` payment routes. Reject custom
schemes and show an interstitial before opening a payment link from assistant
content.

**Verify**: tests prove `javascript:`, arbitrary custom schemes, untrusted hosts,
and malformed URLs do not call `Linking.openURL`.

### Step 4: Audit markdown parser exposure

Review the `react-native-markdown-display` dependency chain and the reported
high `linkify-it` advisories before release. Upgrade or replace the parser only
after confirming Expo SDK 54 compatibility and preserving native rendering.

**Verify**: `pnpm audit --filter @finora/mobile --prod --audit-level high` has no
reachable high advisory in the selected markdown path, or the unresolved
advisory is documented with an explicit release decision.

## Done criteria

- [ ] Unknown or expired payment requests cannot reach approval.
- [ ] Crypto QR destinations are chain/network validated.
- [ ] Assistant markdown opens only allowlisted URLs.
- [ ] High markdown-parser advisory is fixed or formally accepted.
- [ ] Typecheck, lint, and tests pass.

## STOP conditions

- The backend cannot authenticate or return canonical payment-request data.
- A chain lacks a maintained validator for a supported rail.
- Replacing markdown changes the assistant message protocol unexpectedly.

## Maintenance notes

Treat QR, deep links, and assistant links as untrusted input. Keep validation at
the boundary and never rely on a syntactic ID as authorization.
