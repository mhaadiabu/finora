# Plan 006: Align mobile dependencies and project skills

> **Executor instructions**: Follow this plan step by step. Do not perform a
> broad framework upgrade without a compatibility matrix. Stop and report on
> any STOP condition. Update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat cbfb3a8..HEAD -- apps/mobile/package.json pnpm-lock.yaml .agents/skills`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-restore-mobile-verification-baseline.md`
- **Category**: migration / dx / tech-debt
- **Planned at**: commit `cbfb3a8`, 2026-08-25

## Why this matters

The app has manifest drift and dead dependencies, while the repo's assistant-ui
skills teach the wrong package and web APIs. Expo checks report React Navigation
version drift, a missing `expo-asset` peer for `expo-audio`, duplicate SDK 54/57
native modules, and a Metro config that replaces Expo defaults. `pnpm audit`
also reports a high `linkify-it` advisory through the native markdown parser.
Agents following the current skills can produce code that does not build in this
Expo app.

## Current state

- `apps/mobile/package.json:16-81` uses Expo 54, React Native assistant-ui
  `0.1.35`, AI SDK `7.0.65`, NativeWind `5.0.0-preview.4`, and many broad
  ranges.
- `pnpm --filter @finora/mobile exec expo install --check` reports
  `@react-navigation/bottom-tabs`, `native`, and `drawer` version drift.
- `pnpm-lock.yaml:229` resolves `expo-audio@1.1.1` against
  `expo-asset@57.0.9`, while the app itself is Expo 54. The installed
  `expo-audio` manifest declares `expo-asset` as a peer dependency, but mobile
  does not declare the SDK 54 peer directly.
- `apps/mobile/metro.config.js:10-20` overwrites `watchFolders`,
  `nodeModulesPaths`, and `extraNodeModules` instead of preserving the defaults
  returned by `getDefaultConfig`.
- `assistant-cloud`, `expo-auth-session`, `expo-speech-recognition`,
  `react-native-qrcode-svg`, and `semver` have no direct mobile source imports;
  `local-thread-adapter.ts:64-160` also has no call site.
- `.agents/skills/assistant-ui/SKILL.md:69-82`, `primitives/SKILL.md:24-35`,
  `runtime/SKILL.md:35-63`, `tools/SKILL.md:61-79`, and
  `update/SKILL.md:31-42` document `@assistant-ui/react`, DOM examples, and
  web migration thresholds, not `@assistant-ui/react-native`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Expo compatibility | `pnpm --filter @finora/mobile exec expo install --check` | no unexpected drift |
| Expo doctor | `pnpm dlx expo-doctor@latest apps/mobile` | all checks pass or only documented intentional exceptions remain |
| Dependency audit | `pnpm audit --filter @finora/mobile --prod --audit-level high` | no unreviewed reachable high advisories |
| Typecheck | `pnpm --filter @finora/mobile check-types` | exit 0 |
| Lint | `pnpm --filter @finora/mobile lint` | exit 0 |

## Scope

Mobile manifest/lockfile, unused adapter/dependencies confirmed by source search,
and the assistant-ui/Expo project skill files. Do not upgrade Expo SDK in this
plan. Do not remove a package used only by native config without checking its
plugin contract.

## Steps

### Step 1: Build the compatibility matrix

Record installed and latest versions for Expo SDK 54-compatible packages,
React Navigation, React Native, assistant-ui RN, AI SDK, NativeWind preview,
`expo-audio`/`expo-asset`, and markdown rendering. Use version-pinned Expo v54
docs and the installed package manifests, not generic latest examples. Remove
SDK 57 `expo-asset`/`expo-constants` resolution from the SDK 54 graph.

**Verify**: the matrix names each intentional pin and each candidate upgrade.

### Step 2: Restore Expo Metro defaults

Append the monorepo root and resolver paths to the defaults returned by
`getDefaultConfig` instead of replacing them. Preserve the repo's single-React
invariant and confirm Metro still resolves the junctioned React, React DOM, and
React Native instances.

**Verify**: `pnpm dlx expo-doctor@latest apps/mobile` passes the Metro config
check; a native bundle resolves one React instance.

### Step 3: Remove confirmed dead code and dependencies

Confirm with `pnpm why`, config inspection, and source search before removing
`local-thread-adapter.ts` or unused direct dependencies. Keep any package needed
for a config plugin, transitive runtime, or web target. Add a lightweight
unused-dependency check to the mobile workflow if the repo has a suitable
read-only tool.

**Verify**: typecheck/lint pass and `pnpm why` no longer shows removed direct
dependencies as mobile-owned.

### Step 4: Resolve the markdown advisory

Upgrade or replace `react-native-markdown-display` only after testing native
rendering and link handling. If the advisory is transitive and cannot be fixed
under Expo 54, record the accepted risk and a removal date in the plan/issue.

**Verify**: production audit output is clean or the exception is explicit and
reachable code is not exposed to untrusted content.

### Step 5: Add mobile-aware skill guidance

Mark the current web assistant-ui skills as web-only. Add a mobile section or
new skill covering `@assistant-ui/react-native`, `makeAssistantToolUI` hook-safe
patterns, Expo SDK 54 version checks, NativeWind v5 preview constraints, and
this repo's remote-thread adapter. Update the migration skill to detect both
web and native package names and route to the right docs.

**Verify**: a cold reader can identify the correct mobile package/imports and
the skill examples do not import `@assistant-ui/react` for Expo code.

## Done criteria

- [ ] Mobile manifest matches the documented Expo SDK 54 compatibility matrix.
- [ ] `expo-audio` uses the correct SDK 54 peer graph with no SDK 57 native duplicates.
- [ ] Metro extends Expo defaults and passes `expo-doctor`.
- [ ] Confirmed dead dependencies/adapter are removed or explicitly retained.
- [ ] Reachable markdown high advisory is fixed or formally accepted.
- [ ] Project skills contain accurate mobile assistant-ui and Expo guidance.
- [ ] Typecheck, lint, and Expo compatibility checks pass.

## STOP conditions

- A dependency removal affects a native config plugin or production build.
- A candidate upgrade requires Expo SDK 55+ or a new native build without an
  approved migration plan.
- The assistant-ui RN package has no documented migration path for the desired
  version.

## Maintenance notes

When adding a mobile package, record why it is direct, its Expo SDK compatibility,
and the corresponding skill/reference. Keep web and native assistant-ui advice
separate so future agents do not cross the package boundary.
