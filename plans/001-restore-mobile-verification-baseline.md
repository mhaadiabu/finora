# Plan 001: Restore a deterministic mobile verification baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report instead of improvising. When done,
> update the status row in `plans/README.md`.
>
> **Drift check**: `git diff --stat cbfb3a8..HEAD -- apps/mobile`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx / correctness
- **Planned at**: commit `cbfb3a8`, 2026-08-25

## Why this matters

`check-types` passes, but the mobile lint command fails with 25 errors and 21
warnings. The command also auto-created an untracked `apps/mobile/eslint.config.js`
when no committed config existed. Many errors come from hooks called inside
`makeAssistantToolUI` render callbacks, so the current feedback loop cannot
reliably catch regressions in the chat surface.

## Current state

- `apps/mobile/package.json:6-13` exposes `check-types` and `lint`, but there is
  no tracked mobile ESLint config.
- `apps/mobile/components/chat/CreateEmployeeToolUI.tsx:56-91` calls
  `useTheme()` inside the `render` callback. The same pattern appears in the
  list, payroll, supplier, treasury, and send tool UIs; `expo lint` reports the
  Rules of Hooks error at 25 sites.
- `apps/mobile/app/_layout.tsx:294-312` has contradictory hook dependency
  warnings around the remote runtime adapter.
- `apps/mobile/components/assistant-ui/composer.tsx:310-318` registers an
  AppState effect without the stable `stopRecording` dependency.

Match the existing component style and NativeWind conventions. Keep tool UI
render callbacks as pure argument-to-component adapters; move hooks into named
capitalized React components.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @finora/mobile check-types` | exit 0 |
| Lint | `pnpm --filter @finora/mobile lint` | exit 0, no errors |
| Workspace check | `pnpm check` | exit 0; do not accept formatter changes outside scope |

## Scope

**In scope**: `apps/mobile/eslint.config.js` if the Expo-generated config is
appropriate, the reported `apps/mobile/components/chat/**` files, and the
reported runtime/composer files.

**Out of scope**: payment semantics, storage migration, dependency upgrades,
unrelated formatting, and generated `apps/mobile/dist/**` output.

## Steps

### Step 1: Establish the committed lint configuration

Run `pnpm --filter @finora/mobile lint` once and inspect the generated config
without keeping unrelated defaults. Commit a minimal config that uses the
installed Expo preset and preserves the repo's TypeScript/React hook rules.

**Verify**: `git ls-files apps/mobile/eslint.config.js` prints the config path;
`pnpm --filter @finora/mobile lint` reaches source diagnostics without creating
another untracked config.

### Step 2: Make tool render callbacks hook-safe

For every lint error, create a named component such as
`CreateEmployeeToolContent` that owns `useTheme`, `useAuth`, or state hooks.
Keep the exported `makeAssistantToolUI` callback limited to validating args and
returning that component. Preserve tool names, result shapes, and visual output.

**Verify**: `pnpm --filter @finora/mobile lint` reports no
`react-hooks/rules-of-hooks` errors.

### Step 3: Resolve remaining hook warnings deliberately

Fix only dependency arrays whose captured values are genuinely needed. For the
remote runtime, depend on stable config identity or memoized primitives rather
than object properties that cannot trigger renders. For recording cleanup,
stabilize `stopRecording` or use a ref so the AppState subscription is not
recreated on every render.

**Verify**: lint has no exhaustive-deps errors; `pnpm --filter @finora/mobile check-types`
exits 0.

## Test plan

No new test framework is required for this baseline. Manually exercise one
loading and one completed instance of a list tool, a payment tool, payroll
proposal UI, and voice composer after lint passes. Use the existing app runtime
and do not add snapshots.

## Done criteria

- [ ] A tracked ESLint config exists and `expo lint` does not mutate the tree.
- [ ] `pnpm --filter @finora/mobile lint` exits 0 with no errors.
- [ ] `pnpm --filter @finora/mobile check-types` exits 0.
- [ ] Tool UI render callbacks contain no direct hook calls.
- [ ] No files outside the Scope list are modified.

## STOP conditions

- The installed `makeAssistantToolUI` API requires hooks in render callbacks,
  contrary to the lint rule. Stop and document the package behavior.
- Fixing a hook warning requires changing a public tool result or runtime
  protocol. Stop and report the exact contract.
- Expo lint attempts to overwrite unrelated root configuration.

## Maintenance notes

Keep future tool UI additions in named components. Reviewers should reject new
hooks directly inside `makeAssistantToolUI({ render })` callbacks. This plan
does not address the stale assistant-ui skill guidance; plan 006 owns that.
