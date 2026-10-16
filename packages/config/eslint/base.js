// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const sharedIgnores = globalIgnores([
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.vitest/**',
]);

/**
 * Regras TypeScript com informação de tipos, compartilhadas por pacotes e apps.
 * O lint tipado detecta promessas não tratadas, `any` inseguro e switches não exaustivos.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function typescriptRules({ tsconfigRootDir }) {
  return defineConfig([
    {
      files: ['**/*.{ts,tsx,mts,cts}'],
      extends: [tseslint.configs.recommendedTypeChecked],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-misused-promises': [
          'error',
          { checksVoidReturn: { attributes: false } },
        ],
        '@typescript-eslint/switch-exhaustiveness-check': [
          'error',
          { considerDefaultExhaustiveForUnions: true },
        ],
        eqeqeq: ['error', 'smart'],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
      },
    },
  ]);
}

/**
 * Configuração completa para pacotes de biblioteca (código TypeScript puro + scripts Node).
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function createLibraryConfig({ tsconfigRootDir }) {
  return defineConfig([
    sharedIgnores,
    js.configs.recommended,
    typescriptRules({ tsconfigRootDir }),
    {
      files: ['**/*.{js,mjs,cjs}'],
      languageOptions: { globals: globals.node },
    },
  ]);
}
