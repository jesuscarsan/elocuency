import { buildPlugin } from '../../../libs/obsidian-plugin/scripts/esbuild.config.mjs';

buildPlugin({
	pluginId: 'elocuency',
	entryPoints: ['src/Infrastructure/Presentation/Obsidian/main.ts'],
	outfile: 'dist/main.js',
}).catch((error) => {
	console.error(error);
	process.exit(1);
});
