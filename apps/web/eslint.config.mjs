import { sharedIgnores, typescriptRules } from '@codexveil/config/eslint/base';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  sharedIgnores,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  ...nextVitals,
  ...nextTs,
  typescriptRules({ tsconfigRootDir: import.meta.dirname }),
]);
