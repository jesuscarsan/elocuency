import { mergeConfig } from 'vitest/config';
import baseConfig from '../../libs/core-ts/vitest.config.base';
import path from 'path';

export default mergeConfig(baseConfig, {
	test: {
		alias: {
			obsidian: path.resolve(__dirname, './src/__mocks__/obsidian.ts'),
			src: path.resolve(__dirname, './src'),
			'@': path.resolve(__dirname, './src'),
		},
		coverage: {
			exclude: [
				'src/**/*.d.ts',
				'src/**/__mocks__/**',
				'src/Infrastructure/Testing/**',
				'src/main.ts',
				'**/*.test.ts',
				'**/*.spec.ts',
				'src/__test-utils__/**',
				'**/*Mother.ts',
			],
		},
	},
});
