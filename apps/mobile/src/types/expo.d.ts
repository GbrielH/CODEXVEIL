// Tipos globais do Expo (process.env.EXPO_PUBLIC_*, require de assets etc.). O Expo gera
// `expo-env.d.ts` com esta mesma referência ao iniciar, mas ele não é versionado; esta
// cópia garante typecheck e lint também em CI, antes de qualquer `expo start`.
/// <reference types="expo/types" />
