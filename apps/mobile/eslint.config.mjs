// @ts-check
import { sharedIgnores, typescriptRules } from '@codexveil/config/eslint/base';
import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  sharedIgnores,
  globalIgnores(['dist/**', '.expo/**', 'android/**', 'ios/**', 'expo-env.d.ts']),
  expoConfig,
  typescriptRules({ tsconfigRootDir: import.meta.dirname }),
]);
