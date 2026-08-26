# WeWire integration plan

## Where we are

`main` is current. The API advertises itself as `mock`, and every money route still reads from `apps/api/src/mock/store.ts`. `packages/wewire` has a hand-written `WewireClient`, but nothing in the API imports it.

The official docs expose an OpenAPI spec at `https://stage-capi.wewireafrica.com/endpoints/spec`. It contains 68 operations and 106 schemas. That spec disagrees with the current hand-written client in several places, so the client should not be treated as authoritative. Examples: the live sub-customer purpose enum is `PAYOUT | COLLECTION`, onboarding is `DRAFT | IN_REVIEW | REJECTED | RESUBMISSION | APPROVED`, transaction types are only `DEBIT | CREDIT`, and purpose codes are `POP001` through `POP032`. Finora currently uses invented values for all four.

One Finora platform business sits on WeWire. After a user completes signup and selects an immutable Finora profile type (`INDIVIDUAL`, `SOLE_PROPRIETORSHIP`, or `BUSINESS`), Finora provisions one matching WeWire sub-customer. Each user owns isolated wallets, starts with GHS, and adds NGN or USD on request. USD is available for international payouts from day one once KYC permits money movement. Each user completes their own post-signup KYC flow.

## Architecture

Keep the existing boundary:

1. Mobile and MCP call only Finora API endpoints.
2. Shared Zod contracts stay in `packages/shared`.
3. `packages/wewire` stays server-only and becomes the sole HTTP wrapper around WeWire.
4. API handlers persist Finora state in Postgres, translate it into WeWire calls, and normalize WeWire responses back into public Finora shapes.

Money movement remains:

`prepare -> policy check -> human approval + PIN/biometrics -> execute_approved_* -> audit`

Reads and previews can hit WeWire immediately. Execution calls happen only inside the approval resolver after the human decision. MCP keeps its read-and-prepare-only tool catalog.

## Phases

### Phase 0: contract reset

- Generate or derive typed schemas from the official OpenAPI document rather than maintaining guesses by hand.
- Replace stale shared enums (`SubCustomerPurpose`, `SubCustomerOnboardingStatus`, wallet transaction enums, `PurposeCode`) with WeWire’s real values plus explicit Finora presentation mappings where needed.
- Add a `WW_MODE=sandbox|production|mock` setting. Keep mock mode working so demos remain honest and sandbox credentials are never implied to be production rails.
- Introduce a single API helper that resolves the current Clerk user, finds their linked WeWire sub-customer, and returns both database records and the typed client. Signup provisions the link after the user chooses an immutable profile type.

### Phase 1: identity and wallets

Map each authenticated Finora profile to one active WeWire sub-customer using a stable `referenceId` derived from the Finora user ID. Provision GHS immediately and create NGN or USD only when the user requests that currency. Allow account reads before KYC, but block funding, payouts, conversions, transfers, and withdrawals until WeWire returns `APPROVED`. Support individual, sole-proprietorship, and general-business onboarding; make the selected type immutable after provisioning.

Add these tables:

- `wewire_sub_customers`: Finora user, WeWire sub-customer ID, status, onboarding state, timestamps.
- `wewire_wallets`: local cache of wallet IDs, currency, balance, status, owner kind (`user` or `business`), timestamps.
- `wewire_transactions`: canonical Finora activity, WeWire transaction ID, approval ID, idempotency key, raw status, normalized status, amount, fee, currency, rail, payload snapshot.
- `wewire_webhook_events`: provider event ID, type, signature verification result, payload, processing state.

Wire these capabilities first:

- List business and sub-customer wallets.
- Create requested currencies.
- Request virtual accounts.
- Issue and list crypto addresses.
- Show balances and account details from normalized WeWire data.

This phase gives the app a real financial account without moving money.

### Phase 2: recipients, lookups, and quotes

- Replace fake bank/mobile-money lookup handlers with `GET /v1/account-lookup`.
- Use `GET /v1/banks?currency=GHS|NGN` instead of hard-coded banks.
- Implement beneficiary CRUD against `/v1/beneficiaries`, preserving Finora contact metadata locally and WeWire IDs remotely.
- Call `GET /v1/rates`, `GET /v1/rates/pair`, `POST /v1/rates/conversion/preview`, and `POST /v1/fees/payout` for quotes and fee previews.
- Persist quote snapshots on preparations because WeWire conversion previews do not appear to return an executable quote token. Recheck the rate at execution and fail safely if the user approved materially different economics.

### Phase 3: approvals and money movement

Make the approval record durable before touching WeWire. At minimum it needs requester, kind, payload snapshot, policy result, status, idempotency key, resolved-by/resolved-at, execution attempt, and WeWire transaction IDs.

Implement preparation and execution pairs:

- Local Ghana/Nigeria bank and MoMo payout: `POST /v1/disbursements`.
- International beneficiary payout: `POST /v1/transactions/initiate-payout`.
- Sub-customer-to-sub-customer transfer: `POST /v1/subcustomers/{id}/transfer`.
- FX between user wallets: preview then `POST /v1/subcustomers/{id}/conversions`.
- Crypto withdrawal: `POST /v1/subcustomers/{id}/wallets/{walletId}/withdraw`.
- Payroll/supplier/invoice payments: prepare one approval per run or invoice, then fan out into idempotent WeWire disbursements during execution. Fund payroll directly from Finora’s business wallet.

Execution rules:

- Generate the idempotency key when the user approves, not on every retry.
- Store it before calling WeWire.
- Treat network timeouts as unknown, then reconcile by polling or webhook rather than blindly retrying with a new key.
- Map `PENDING`, `SUCCESSFUL`, `FAILED`, `REVERSED`, and `CANCELLED` into stable Finora states without exposing raw provider churn to mobile.

Collections are a separate flow. Do not overload disbursement approvals for them.

### Phase 4: reconciliation and observability

- Verify `WEWIRE_WEBHOOK_SECRET` before parsing event handling logic beyond the raw body.
- Persist webhook events before applying them.
- Process idempotently and update cached wallets and transaction states.
- Poll unresolved executions on a schedule. Until WeWire confirms webhook availability and payload behavior for our account, polling is the source of truth and webhooks are only an optimization.
- Add structured logs for mode, endpoint operation ID, Finora approval ID, WeWire transaction ID, and retryability. Never log credentials, PINs, full beneficiary secrets, or raw KYC documents.
- Surface pending/provider-failed states honestly in mobile and MCP.

### Phase 5: onboarding and compliance

Implement individual KYC submission and hosted links first.

Then implement sole-proprietorship and general-business KYC:

1. Read requirements.
2. Submit company details.
3. Upload documents.
4. Manage beneficial owners.
5. Submit for review.
6. Reflect `DRAFT`, `IN_REVIEW`, `RESUBMISSION`, `APPROVED`, and `REJECTED` accurately.

Each user completes their own KYC in the post-signup flow. Immutable profile type determines whether Finora collects individual data, sole-proprietorship data, or business data plus beneficial owners. Sweeping and auto-sweep should follow once users can hold funded wallets.

## Suggested first slice

Land this in small commits:

1. Contract reset plus typed client regeneration.
2. Link Finora users to WeWire sub-customers and expose wallet/account reads.
3. Durable approvals and one end-to-end Ghana MoMo payout in sandbox.
4. Recipient lookup, beneficiaries, and bank payouts.
5. FX and international payouts.

The first demo-worthy milestone is a sandbox user whose wallet balance comes from WeWire, who requests a MoMo payout, sees it in Approvals, approves with PIN, and gets a real sandbox transaction ID reconciled back into Finora activity.

## Resolved decisions

- Provision each user’s WeWire sub-customer immediately after signup and profile-type selection.
- Make profile type immutable across `INDIVIDUAL`, `SOLE_PROPRIETORSHIP`, and `BUSINESS`.
- Launch with GHS immediately and provision NGN or USD on request.
- Treat USD as an international payout currency from day one, subject to KYC approval.
- Fund payroll directly from the Finora business wallet.
- Treat polling as authoritative until WeWire confirms webhook availability for our account.
- Give every user their own post-signup KYC flow; allow provider reads before approval and block all money movement until approval.
