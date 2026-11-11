import config, { reactConfig } from '@iobroker/eslint-config';

export default [
    ...config,
    ...reactConfig.map(c => ({ ...c, files: ['src-www/**/*.{ts,tsx}'] })),
    {
        ignores: ['build/', 'www/', 'node_modules/', 'test/', 'src-www/public/', '*.config.mjs', 'vite.config.ts'],
    },
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.mjs', 'scripts/*.ts'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Kommentare dort, wo sie helfen – nicht an jedem Feld
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/require-returns': 'off',
            // Neue JSX-Transform (React 17+) braucht kein React im Scope
            'react/react-in-jsx-scope': 'off',
        },
    },
];
