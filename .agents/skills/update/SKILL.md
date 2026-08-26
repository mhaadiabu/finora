---
name: update
description: 'Upgrade assistant-ui and apply migrations across package versions and AI SDK releases. Covers current v0.15 runtime accessors, removed legacy hooks, tool registries, primitive render functions, streaming response changes, and the assistant-ui upgrade and doctor commands. For Expo, check the repository SDK 54 matrix before changing packages.'
license: MIT
---

# assistant-ui Update

**Always verifies against npm ground truth and GitHub commits.**

## References

- [./references/ai-sdk-v6.md](./references/ai-sdk-v6.md) -- AI SDK v4/v5 → v6 migration (complete guide)
- [./references/assistant-ui.md](./references/assistant-ui.md) -- assistant-ui version migrations
- [./references/breaking-changes.md](./references/breaking-changes.md) -- Quick reference table

## Phase 1: Detect Versions

### Get Ground Truth

```bash
npm ls @assistant-ui/react @assistant-ui/react-ai-sdk ai @ai-sdk/react 2>/dev/null

npm view @assistant-ui/react version
npm view @assistant-ui/react-ai-sdk version
npm view ai version
```

### Version Analysis

Current latest: `@assistant-ui/react` 0.15.x, `@assistant-ui/react-ai-sdk` 1.4.x, `assistant-stream` 0.3.x, `@assistant-ui/core` 0.3.x, `@assistant-ui/store` 0.3.x.

| Package                      | Check For                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai`                         | < 6.0.0 → needs AI SDK v6 migration                                                                                                                                     |
| `@assistant-ui/react`        | < 0.15.0 → `aui` scope accessors become properties; legacy context hooks removed; `s.tools.tools` → `s.tools.toolUIs`; `"mcp-app"` group key → `"standalone-tool-call"` |
| `@assistant-ui/react`        | < 0.14.0 → primitives `components` prop replaced by children render functions; deprecated hooks/aliases removed                                                         |
| `@assistant-ui/react`        | < 0.13.0 → `ThreadPrimitive.ViewportSlack` removed (top-anchor changes)                                                                                                 |
| `@assistant-ui/react`        | < 0.12.0 → unified state API (`useAui`/`useAuiState`/`useAuiEvent`/`AuiIf`)                                                                                             |
| `@assistant-ui/react`        | < 0.11.0 → runtime rearchitecture                                                                                                                                       |
| `@assistant-ui/react`        | < 0.10.0 → ESM only                                                                                                                                                     |
| `@assistant-ui/react`        | < 0.8.0 → UI split (shadcn registry)                                                                                                                                    |
| `@assistant-ui/react-ai-sdk` | < 1.0.0 → needs AI SDK v6 first                                                                                                                                         |

`@assistant-ui/react-ai-sdk` 1.4.x also supports AI SDK v7; v6 remains supported, so an `ai@7` bump is optional and independent of the assistant-ui upgrade.

## Phase 2: Route to Migration

```
AI SDK < 6.0.0?
├─ Yes → See ./references/ai-sdk-v6.md
└─ No
   └─ assistant-ui outdated?
      ├─ Yes → See ./references/assistant-ui.md
      └─ No → Already up to date
```

### Migration Order

1. **AI SDK first** (if < 6.0.0) - Required for @assistant-ui/react-ai-sdk >= 1.0
2. **assistant-ui second** - Apply breaking changes for version jump
3. **Verify** - Type check, build, test

## Phase 3: Execute

### Update Packages

The CLI knows which assistant-ui packages are installed and bumps them together:

```bash
npx assistant-ui@latest update          # add --dry to print the command instead
```

Equivalent manual form (AI SDK packages are not covered by `update`):

```bash
pnpm add @assistant-ui/react@latest @assistant-ui/react-ai-sdk@latest ai@latest @ai-sdk/react@latest

npm install @assistant-ui/react@latest @assistant-ui/react-ai-sdk@latest ai@latest @ai-sdk/react@latest
```

### Apply Codemods

```bash
npx assistant-ui@latest upgrade         # add -d for a dry run, -p to print transformed files
```

Then apply the remaining hand migrations from the references for the version jump.

### Verify

```bash
npx assistant-ui@latest doctor
npx tsc --noEmit
pnpm build
```

## Troubleshooting

**"Peer dependency conflict"**

- Update all packages together
- Check version compatibility in [./references/breaking-changes.md](./references/breaking-changes.md)

**Type errors after upgrade**

- Consult breaking changes reference
- Check specific migration guide

**Runtime errors**

- Verify API patterns match new version
- Check for renamed/moved APIs
