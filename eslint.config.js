export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                setTimeout: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            semi: ['error', 'always'],
            quotes: ['error', 'single', { avoidEscape: true }],
        },
    },
];
