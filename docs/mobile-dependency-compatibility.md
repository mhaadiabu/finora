# Mobile dependency compatibility

Checked on 2026-08-25 for the Expo SDK 54 mobile app.

Expo packages use the versions selected by the SDK 54 package map. A newer npm release is not a mobile upgrade candidate unless Finora first moves to the matching Expo SDK.

| Package                       | Installed or declared                  | Latest npm                       | Decision                                                                                                                     |
| ----------------------------- | -------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Expo                          | 54.0.37                                | 57.0.16                          | Keep SDK 54. Upgrade only in a separate migration.                                                                           |
| React / React DOM             | 19.1.0                                 | 19.2.8                           | Keep the exact Expo SDK 54 runtime pins in the root and mobile manifests.                                                    |
| React Native                  | 0.81.5                                 | 0.87.0                           | Keep the SDK 54 version.                                                                                                     |
| expo-audio                    | 1.1.1                                  | 57.0.4                           | Keep the SDK 54 version.                                                                                                     |
| expo-asset                    | 12.0.13                                | 57.0.14                          | Keep as a direct expo-audio peer. This prevents pnpm from selecting SDK 57 native modules.                                   |
| React Navigation bottom tabs  | declared ^7.4.0, resolved 7.18.17      | 7.18.17                          | Keep the SDK 54 validation range.                                                                                            |
| React Navigation drawer       | declared ^7.5.0, resolved 7.13.9       | 7.13.9                           | Keep the SDK 54 validation range.                                                                                            |
| React Navigation native       | declared ^7.1.8, resolved 7.3.17       | 7.3.17                           | Keep the SDK 54 validation range.                                                                                            |
| @assistant-ui/react-native    | 0.1.35                                 | 0.1.38                           | Keep the exact pin until its native changelog and runtime adapter behavior are reviewed.                                     |
| AI SDK                        | 7.0.65                                 | 7.0.79                           | Keep the product-tested pin. Upgrade independently from Expo after checking shared API contracts.                            |
| assistant-stream              | 0.3.39                                 | 0.3.39                           | Current.                                                                                                                     |
| NativeWind                    | 5.0.0-preview.4                        | npm latest is the stable v4 line | Keep the v5 preview with react-native-css 3.0.7. Do not replace it with v4 as a routine update.                              |
| react-native-markdown-display | 7.0.2                                  | 7.0.2                            | No upstream update exists. Keep it with the patched linkify-it override below.                                               |
| linkify-it                    | overridden to 5.0.2 for markdown-it 10 | 6.1.0                            | 5.0.2 is the first release that fixes both audited quadratic-complexity advisories and remains a narrow transitive override. |

## Verification

Run these commands after changing a mobile runtime dependency:

```bash
pnpm --filter @finora/mobile exec expo install --check
pnpm dlx expo-doctor@latest apps/mobile
pnpm --filter @finora/mobile check-types
pnpm exec oxlint apps/mobile
```

The mobile production audit still reports high advisories inherited from Expo and React Native build tooling. The reachable linkify-it advisory from assistant markdown is fixed by the markdown-it 10 override in pnpm-workspace.yaml. API-only xlsx advisories are outside the mobile app.

## Retained and removed candidates

- Keep semver as a direct mobile dependency while scripts/link-mobile-deps.mjs links it into apps/mobile/node_modules.
- Keep local-thread-adapter.ts because account isolation now scopes its storage by active user, even though the current runtime does not import it.
- Removed direct dependencies with no source or config use: assistant-cloud, expo-auth-session, expo-speech-recognition, react-native-qrcode-svg, and the unused Fraunces font package.
