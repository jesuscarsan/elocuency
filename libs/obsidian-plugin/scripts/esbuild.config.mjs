import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

export async function buildPlugin(options) {
	const {
		pluginId,
		entryPoints = ['src/main.ts'],
		outfile = 'dist/main.js',
		external = ['obsidian', 'fs', 'path', 'child_process'],
		cssEntry = 'src/Infrastructure/Obsidian/styles.css',
		copyFiles = ['manifest.json', '.hotreload'],
	} = options;

	const args = process.argv.slice(2);
	const watch = args.includes('--watch');

	// Attempt to find elo-config.json by walking up directories
	let currentDir = process.cwd();
	let configPath = null;
	while (currentDir !== path.parse(currentDir).root) {
		const checkPath = path.join(currentDir, 'elo-config.json');
		const workspaceCheckPath = path.join(currentDir, 'workspace', 'elo-config.json');
		const eloWorkspaceCheckPath = path.join(currentDir, 'elo-workspace', 'elo-config.json');

		if (fs.existsSync(eloWorkspaceCheckPath)) {
			configPath = eloWorkspaceCheckPath;
			break;
		} else if (fs.existsSync(workspaceCheckPath)) {
			configPath = workspaceCheckPath;
			break;
		} else if (fs.existsSync(checkPath)) {
			configPath = checkPath;
			break;
		}
		currentDir = path.dirname(currentDir);
	}

	if (!configPath) {
		console.error('Could not find elo-config.json in root or workspace/');
		process.exit(1);
	}

	const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	const markdownVaults = config.markdownVaults || [];

	const targetDirs = markdownVaults.map((vault) => path.join(vault, `.obsidian/plugins/${pluginId}`));

	const copyPlugin = {
		name: 'copy-plugin',
		setup(build) {
			build.onEnd(() => {
				targetDirs.forEach((dir) => {
					if (!fs.existsSync(dir)) {
						fs.mkdirSync(dir, { recursive: true });
					}

					const filesToCopy = [outfile, ...copyFiles];

					if (watch) {
						filesToCopy.push(`${outfile}.map`);
					}

					// Handle CSS inclusion
					if (cssEntry && fs.existsSync(cssEntry)) {
						filesToCopy.push({ src: cssEntry, dest: 'styles.css' });
					}

					filesToCopy.forEach((file) => {
						const src = typeof file === 'string' ? file : file.src;
						const destName = typeof file === 'string' ? path.basename(file) : file.dest;

						if (fs.existsSync(src)) {
							const dest = path.join(dir, destName);
							fs.copyFileSync(src, dest);
							console.log(`Copied ${src} to ${dest}`);
						}
					});
				});
			});
		},
	};

	const buildOptions = {
		entryPoints,
		outfile,
		bundle: true,
		platform: 'browser',
		target: 'es2018',
		format: 'cjs',
		sourcemap: watch ? 'inline' : false,
		external,
		plugins: [copyPlugin],
		logLevel: 'info',
		banner: {
			js: '/* eslint-disable */\n',
		},
		alias: {
			'@': './src',
		},
	};

	if (watch) {
		// For watch mode, we specifically want external sourcemaps usually, but let's stick to simple logic or user pref.
		// The original code had `sourcemap: watch`, which implies boolean true (generates .js.map).
		// Let's revert to boolean to match original behavior if desired, or keep inline.
		// Original: sourcemap: watch
		buildOptions.sourcemap = true; // Generate .map files

		const ctx = await esbuild.context(buildOptions);
		await ctx.watch();
		console.log('Watching for changes...');
		
		// Esbuild watch mode only tracks module graph files.
		// We manually watch extra static files like manifest.json and styles.css
		// and copy them directly to the target vaults when changed.
		const extraFiles = copyFiles.map(f => typeof f === 'string' ? f : f.src).filter(Boolean);
		if (cssEntry && typeof cssEntry === 'string') {
			extraFiles.push(cssEntry);
		}

		let timeout;
		fs.watch(process.cwd(), { recursive: true }, (eventType, filename) => {
			if (!filename) return;
			if (filename.includes('dist') || filename.includes('node_modules') || filename.includes('.git')) return;
			
			// Check if the modified file matches any of the extra files (e.g., manifest.json, styles.css)
			const isExtraFile = extraFiles.some(ef => filename.endsWith(ef));
			if (isExtraFile) {
				if (timeout) clearTimeout(timeout);
				timeout = setTimeout(() => {
					console.log(`\nChange detected in ${filename}, updating vault...`);
					targetDirs.forEach(dir => {
						if (fs.existsSync(dir)) {
							// Determine if we are copying styles.css or an extra file
							const isCss = filename.endsWith(path.basename(cssEntry || 'styles.css'));
							const destName = isCss ? 'styles.css' : path.basename(filename);
							const dest = path.join(dir, destName);
							
							if (fs.existsSync(filename)) {
								fs.copyFileSync(filename, dest);
								console.log(`Copied ${filename} to ${dest}`);
							}
						}
					});
				}, 100);
			}
		});
	} else {
		buildOptions.sourcemap = false;
		await esbuild.build(buildOptions);
	}
}
