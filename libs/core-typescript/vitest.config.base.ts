import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            thresholds: {
                'src/Application/**': {
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
                'src/Infrastructure/Adapters/**': {
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
            },
        },
    },
});
