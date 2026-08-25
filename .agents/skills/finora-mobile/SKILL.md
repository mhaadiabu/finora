---
name: finora-mobile
description: Route all work in Finora's apps/mobile Expo app. Use for any change, review, dependency update, or debugging task under apps/mobile, especially Expo SDK 54, NativeWind v5 preview, @assistant-ui/react-native, Metro, routing, native modules, or mobile package compatibility.
---

# Finora mobile

Use this repository router before the relevant upstream Expo or assistant-ui skill. Keep the upstream skill as the implementation reference, then apply the constraints below.

## Pin Expo guidance to SDK 54

- Read apps/mobile/package.json before choosing APIs or package versions. This app stays on Expo SDK 54 until the user requests a separate upgrade.
- Use https://docs.expo.dev/versions/v54.0.0/, never latest, for Expo API behavior. If an upstream skill describes an SDK 55+ feature, do not use it here.
- Install Expo and React Navigation packages with pnpm --filter @finora/mobile exec expo install. Verify with expo install --check and pnpm dlx expo-doctor@latest apps/mobile.
- Preserve react and react-dom at 19.1.0, react-native at 0.81.5, and the single-React aliases in apps/mobile/metro.config.js.
- Keep expo-asset at the SDK 54 line because it is a direct expo-audio peer.

Current compatibility matrix:

| Package                       | Finora constraint        |
| ----------------------------- | ------------------------ |
| expo                          | ~54.0.37                 |
| react / react-dom             | 19.1.0                   |
| react-native                  | 0.81.5                   |
| expo-audio / expo-asset       | ~1.1.1 / ~12.0.13        |
| @react-navigation/bottom-tabs | ^7.4.0                   |
| @react-navigation/drawer      | ^7.5.0                   |
| @react-navigation/native      | ^7.1.8                   |
| @assistant-ui/react-native    | 0.1.35                   |
| ai / assistant-stream         | 7.0.65 / 0.3.39          |
| nativewind / react-native-css | 5.0.0-preview.4 / ^3.0.7 |

## Use the native assistant-ui package

- Import runtime hooks, primitives, types, and makeAssistantToolUI from @assistant-ui/react-native. Do not copy @assistant-ui/react, DOM, Next.js, shadcn, or @assistant-ui/react-markdown examples into mobile.
- Treat the generic runtime, primitives, tools, markdown, and update skills as web guidance unless their example explicitly targets React Native. Prefer the installed package README and https://www.assistant-ui.com/docs/react-native.
- The React Native MessagePrimitive.Parts and composer APIs may differ from the web package. Check the installed 0.1.35 types before migrating a web deprecation.
- makeAssistantToolUI render callbacks are React component boundaries in this package. Use a named function and call hooks at its top level. Do not extract hook calls into the object initializer or conditional branches.
- Preserve the remote runtime pattern in apps/mobile/app/_layout.tsx and apps/mobile/lib/remote-thread-adapter.ts. Mobile never imports WeWire and never turns a prepare tool into direct execution.

## Route to upstream skills

- Load expo-overview first for Expo work, then its selected leaf skill. Apply the SDK 54 gate above to every recommendation.
- Load expo-upgrade only when the user explicitly requests an Expo SDK change.
- Load the generic assistant-ui skill only for architecture shared with React Native. Use installed native types for final API decisions.
