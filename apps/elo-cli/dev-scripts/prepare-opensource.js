const fs = require('fs');
const path = require('path');

const ANSI_RESET = '\x1b[0m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_RED = '\x1b[31m';
const ANSI_BLUE = '\x1b[34m';

const log = {
	info: (msg) => console.log(`${ANSI_BLUE}[INFO]${ANSI_RESET} ${msg}`),
	success: (msg) => console.log(`${ANSI_GREEN}[SUCCESS]${ANSI_RESET} ${msg}`),
	warn: (msg) => console.log(`${ANSI_YELLOW}[WARN]${ANSI_RESET} ${msg}`),
	error: (msg) => console.log(`${ANSI_RED}[ERROR]${ANSI_RESET} ${msg}`),
};

const MONOREPO_ROOT = path.resolve(__dirname, '../../../');
const CONFIG_PATH = path.join(MONOREPO_ROOT, 'elo-config-dev.json');
const DIST_DIR = path.join(MONOREPO_ROOT, '.dist/open-source-apps');

function getAllFiles(dirPath, arrayOfFiles) {
	const files = fs.readdirSync(dirPath);
	arrayOfFiles = arrayOfFiles || [];

	files.forEach(function (file) {
		if (fs.statSync(dirPath + '/' + file).isDirectory()) {
			arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
		} else {
			arrayOfFiles.push(path.join(dirPath, '/', file));
		}
	});

	return arrayOfFiles;
}

function processApp(appName) {
	const sourceAppPath = path.join(MONOREPO_ROOT, 'apps', appName);
	const destAppPath = path.join(DIST_DIR, appName);

	if (!fs.existsSync(sourceAppPath)) {
		log.error(`Source app not found: ${sourceAppPath}`);
		return;
	}

	log.info(`Processing ${appName}...`);

	// 1. Initial Copy
	// Use cpSync with filter to exclude node_modules, .git, .dist
	try {
		if (fs.existsSync(destAppPath)) {
			// Preserving .git directory if it exists
			const files = fs.readdirSync(destAppPath);
			files.forEach((file) => {
				if (file !== '.git') {
					fs.rmSync(path.join(destAppPath, file), { recursive: true, force: true });
				}
			});
		}
		fs.cpSync(sourceAppPath, destAppPath, {
			recursive: true,
			filter: (src, dest) => {
				return !src.includes('node_modules') && !src.includes('.git') && !src.includes('.dist');
			},
		});
		log.info(`Mirrored base app to ${destAppPath}`);
	} catch (e) {
		log.error(`Failed to copy app: ${e.message}`);
		return;
	}

	// 2. Analyze package.json for @elo dependencies
	const packageJsonPath = path.join(destAppPath, 'package.json');
	if (!fs.existsSync(packageJsonPath)) {
		log.warn(`No package.json found in ${appName}, skipping dependency injection.`);
		return;
	}

	let packageJson;
	try {
		packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	} catch (e) {
		log.error(`Failed to parse package.json: ${e.message}`);
		return;
	}

	const dependencies = packageJson.dependencies || {};
	const devDependencies = packageJson.devDependencies || {};
	const allDeps = { ...dependencies, ...devDependencies };

	// Scan libs to find available packages
	const libsDir = path.join(MONOREPO_ROOT, 'libs');
	const availableLibs = {}; // '@elo/core': 'core-typescript', ...

	if (fs.existsSync(libsDir)) {
		const libFolders = fs.readdirSync(libsDir);
		libFolders.forEach((folder) => {
			const libPkgPath = path.join(libsDir, folder, 'package.json');
			if (fs.existsSync(libPkgPath)) {
				try {
					const libPkg = JSON.parse(fs.readFileSync(libPkgPath, 'utf8'));
					if (libPkg.name) {
						availableLibs[libPkg.name] = folder;
					}
				} catch (e) {
					// ignore
				}
			}
		});
	}

	const eloDeps = Object.keys(allDeps).filter((dep) => dep.startsWith('@elo/'));

	if (eloDeps.length === 0) {
		log.info('No @elo dependencies found.');
		return;
	}

	log.info(`Found internal dependencies: ${eloDeps.join(', ')}`);

	const libsTargetDir = path.join(destAppPath, 'src', 'libs');
	if (!fs.existsSync(libsTargetDir)) {
		fs.mkdirSync(libsTargetDir, { recursive: true });
	}

	const libMappings = {}; // '@elo/obsidian-plugin': 'obsidian-plugin-utils'

	// 3. Inject Libraries
	eloDeps.forEach((depName) => {
		// depName: @elo/core
		const simpleName = depName.replace('@elo/', ''); // core
		const sourceFolderName = availableLibs[depName]; // core-typescript (might be different)

		if (!sourceFolderName) {
			log.warn(`Library package ${depName} not found in libs directory, skipping.`);
			return;
		}

		const libSourcePath = path.join(MONOREPO_ROOT, 'libs', sourceFolderName);

		// We copy source from libs/core-typescript/src -> src/libs/core
		const libSrcSource = path.join(libSourcePath, 'src');
		const libDest = path.join(libsTargetDir, simpleName);

		if (fs.existsSync(libSrcSource)) {
			fs.cpSync(libSrcSource, libDest, { recursive: true });
		} else {
			fs.cpSync(libSourcePath, libDest, {
				recursive: true,
				filter: (src) => !src.includes('node_modules') && !src.includes('.git'),
			});
		}

		log.info(`Injected ${depName} (${sourceFolderName}) into src/libs/${simpleName}`);
		libMappings[depName] = simpleName; // map package name to local folder name

		// Merge dependencies from lib's package.json
		const libPkgPath = path.join(MONOREPO_ROOT, 'libs', sourceFolderName, 'package.json');
		if (fs.existsSync(libPkgPath)) {
			try {
				const libPkg = JSON.parse(fs.readFileSync(libPkgPath, 'utf8'));
				const libDeps = libPkg.dependencies || {};

				Object.keys(libDeps).forEach((d) => {
					// Don't overwrite if existing? Or do?
					// Usually we should be careful. But for now, let's add if missing.
					if (!dependencies[d] && !devDependencies[d]) {
						dependencies[d] = libDeps[d];
						log.info(`  Merged dependency ${d}: ${libDeps[d]}`);
					}
				});
			} catch (e) {
				log.warn(`  Failed to read lib package.json for dependencies: ${e.message}`);
			}
		}

		// Remove from package.json
		if (dependencies[depName]) delete dependencies[depName];
		if (devDependencies[depName]) delete devDependencies[depName];
	});

	// Save updated package.json
	packageJson.dependencies = dependencies;
	packageJson.devDependencies = devDependencies;
	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
	log.info('Updated package.json dependencies.');

	// 4. Rewrite Imports
	const sourceFiles = getAllFiles(path.join(destAppPath, 'src'));
	const tsFiles = sourceFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

	log.info(`Scanning ${tsFiles.length} files for import rewriting...`);

	let rewriteCount = 0;
	tsFiles.forEach((filePath) => {
		let content = fs.readFileSync(filePath, 'utf8');
		let modified = false;

		Object.keys(libMappings).forEach((depName) => {
			const libFolderName = libMappings[depName];

			// Regex to find: from "@elo/utils..." or import ... "@elo/utils"
			// We need to handle subpaths too? e.g. @elo/utils/foo
			// Currently assuming direct imports mostly.
			// Better to match the string literal for import.

			const importRegex = new RegExp(`(['"])(${depName})(.*?)['"]`, 'g');

			if (content.match(importRegex)) {
				// Calculate relative path
				// Target: src/libs/<libFolderName>
				// Current file: filePath

				const fileDir = path.dirname(filePath);
				const targetLibDir = path.join(destAppPath, 'src', 'libs', libFolderName);

				let relativePath = path.relative(fileDir, targetLibDir);
				if (!relativePath.startsWith('.')) {
					relativePath = './' + relativePath;
				}

				// Replace
				content = content.replace(importRegex, (match, quote, pkg, subpath) => {
					// pkg is @elo/obsidian-plugin
					// subpath is anything after, e.g. /sub/module (if any)
					// If we copied 'src', the internal structure is preserved.
					// But typically imports are just from the package root if main is set.
					// If the user imports specific files from the package, it might break unless structure matches exactly.
					// For now, mapping root to root.

					return `${quote}${relativePath}${subpath}${quote}`;
				});

				modified = true;
			}
		});

		if (modified) {
			fs.writeFileSync(filePath, content);
			rewriteCount++;
		}
	});

	log.success(`Rewrite complete. Modified ${rewriteCount} files.`);

	// 5. Patch esbuild.config.mjs (specific to this repo structure)
	const esbuildPath = path.join(destAppPath, 'esbuild.config.mjs');
	if (fs.existsSync(esbuildPath)) {
		let esbuildContent = fs.readFileSync(esbuildPath, 'utf8');
		// Replace config loading with empty mdVaults
		const configRegex =
			/const config = JSON\.parse\(fs\.readFileSync\('\.\.\/\.\.\/elo\.config\.json', 'utf8'\)\);\s*const mdVaults = config\.mdVaults;/;
		if (esbuildContent.match(configRegex)) {
			esbuildContent = esbuildContent.replace(
				configRegex,
				'const mdVaults = []; // Open Source: No auto-deploy',
			);
			fs.writeFileSync(esbuildPath, esbuildContent);
			log.info('Patched esbuild.config.mjs to remove elo.config.json dependency.');
		} else {
			// Try looser match
			const looseRegex = /fs\.readFileSync\('.*elo\.config\.json'.*\)/;
			if (esbuildContent.match(looseRegex)) {
				log.warn(
					'Found elo.config.json read in esbuild, but exact match failed. You may need to manual patch.',
				);
			}
		}
	}
}

function main() {
	log.info('Starting open source preparation...');

	if (!fs.existsSync(CONFIG_PATH)) {
		log.error(`Config file not found: ${CONFIG_PATH}`);
		process.exit(1);
	}

	let config;
	try {
		config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
	} catch (e) {
		log.error(`Failed to parse config file: ${e.message}`);
		process.exit(1);
	}

	const appsToMirror = config.openSourceApps || [];
	if (appsToMirror.length === 0) {
		log.warn('No apps defined in "openSourceApps". Nothing to do.');
		return;
	}

	// Clean dist dir once
	if (!fs.existsSync(DIST_DIR)) {
		fs.mkdirSync(DIST_DIR, { recursive: true });
	}

	appsToMirror.forEach((appName) => {
		processApp(appName);
	});

	log.success('All apps processed.');
}

main();
