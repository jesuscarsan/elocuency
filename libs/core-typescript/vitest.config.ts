import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

export default mergeConfig(baseConfig, {
    test: {
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
        coverage: {
            exclude: ['dist/**', 'node_modules/**', '**/*.test.ts', 'src/index.ts', 'src/Domain/Types/**'],
        },
    },
});
