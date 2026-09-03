import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
    tseslint.configs.recommendedTypeChecked,
    prettierConfig,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        ignores: ['dist/**', 'bin/**'],
    },
    // Global rule overrides
    {
        rules: {
            // Allow async functions without await - useful for interface conformance
            // and future-proofing when a method may need to become async
            '@typescript-eslint/require-await': 'off',
            // Allow unused vars with _ prefix (common pattern for intentionally unused params)
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    // Test file overrides
    {
        files: ['**/*.test.ts'],
        rules: {
            // Allow unbound method references in expect() - common pattern with mock matchers
            '@typescript-eslint/unbound-method': 'off',
            // Allow awaiting sync values - tests may await for interface consistency
            '@typescript-eslint/await-thenable': 'off',
        },
    },
    // Allow namespace in CDP type definitions (copied from playwright-core protocol types)
    {
        files: ['src/types/cdp.ts'],
        rules: {
            '@typescript-eslint/no-namespace': 'off',
        },
    },
    // Screenshot capture uses Playwright's page.evaluate() which runs in browser context
    // where DOM APIs are inherently untyped from TypeScript's perspective
    {
        files: ['src/analysis/utils/screenshot-capture.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
        },
    },
    // Virtual screen reader driver uses dynamic imports and page.evaluate() for browser context
    {
        files: ['src/screen-reader/drivers/virtual.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
        },
    }
);
