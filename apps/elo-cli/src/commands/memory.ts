import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

export const memoryCommand = new Command('memory')
    .description('Manage the Obsidian memory via Elo Server');

memoryCommand
    .command('init')
    .description('Initialize the memory with fundamental templates and structure')
    .option('-l, --lang <lang>', 'Language for the memory templates (es, en)', 'es')
    .action(async (options) => {
        let authToken = process.env.SERVER_AUTH_TOKEN;

        // Try to load token from .env files if not already set
        if (!authToken) {
            const rootDir = process.cwd();
            const potentialEnvPaths = [
                path.join(rootDir, 'apps/elo-server/.env'),
                path.join(rootDir, 'elo-workspace/.env'),
                path.join(rootDir, '.env')
            ];

            for (const envPath of potentialEnvPaths) {
                try {
                    if (fs.existsSync(envPath)) {
                        const envText = fs.readFileSync(envPath, 'utf8');
                        const match = envText.match(/^SERVER_AUTH_TOKEN=(.*)$/m);
                        if (match && match[1]) {
                            authToken = match[1].trim().replace(/^["']|["']$/g, '');
                            console.log(chalk.dim(`🔑 Auth token loaded from: ${path.basename(path.dirname(envPath))}/${path.basename(envPath)}`));
                            break;
                        }
                    }
                } catch (e) {
                    // Ignore fs errors
                }
            }
        }

        // Attempt to find the correct host (localhost vs host.docker.internal for Mac)
        let serverUrl = 'http://localhost:8001';

        const checkHost = async () => {
            const hostsToTry = [
                'http://localhost:8001',
                'http://host.docker.internal:8001'
            ];

            console.log(chalk.dim(`🔍 Testing server connectivity...`));
            for (const baseUrl of hostsToTry) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 1200);

                    const res = await fetch(`${baseUrl}/health`, {
                        method: 'GET',
                        signal: controller.signal
                    });

                    clearTimeout(timeout);
                    if (res.ok) {
                        serverUrl = baseUrl;
                        console.log(chalk.green(`📡 Connection established via: ${baseUrl}`));
                        return;
                    }
                } catch (e) {
                    // Ignore
                }
            }
            console.log(chalk.yellow(`⚠️  Server not reached at localhost:8001 or host.docker.internal:8001.`));
            console.log(chalk.dim(`Defaulting to: ${serverUrl}\n`));
        };

        console.log(chalk.cyan(`\n📦 Initializing Memory...`));
        await checkHost();

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            console.log(chalk.dim(`📤 Sending memory init request to: ${serverUrl}/api/memory/init (lang: ${options.lang})`));

            const response = await fetch(`${serverUrl}/api/memory/init`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    language: options.lang
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                if (response.status === 401 || response.status === 403) {
                    throw new Error(`Authentication failed (HTTP ${response.status}). Check your SERVER_AUTH_TOKEN.`);
                }
                throw new Error(`Server error: ${errorData.detail || response.statusText} (${response.status})`);
            }

            const data = await response.json();
            console.log(chalk.green(`\n✅ ${data.message}`));
            console.log(chalk.dim(`📂 Metadata generated at: ${data.target_path}\n`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });

memoryCommand
    .command('index')
    .description('Index the Obsidian memory into the vector database for semantic search')
    .option('-i, --initialize', 'Clear the database before indexing (alias for --force)')
    .option('-f, --force', 'Clear the database before indexing')
    .action(async (options) => {
        const monorepoRoot = process.cwd();
        const serverDir = path.join(monorepoRoot, 'apps', 'elo-server');
        const syncScript = path.join(serverDir, 'src', 'scripts', 'sync-memory.ts');

        if (!fs.existsSync(syncScript)) {
            console.error(chalk.red(`\n❌ sync-memory.ts not found at: ${syncScript}`));
            console.error(chalk.dim('Make sure you run this command from the monorepo root.'));
            process.exit(1);
        }

        console.log(chalk.cyan('\n🔍 Indexing memory path into vector database...'));
        if (options.initialize || options.force) {
            console.log(chalk.yellow('⚡ Initialize mode: clearing database before indexing.'));
        }

        const { spawnSync } = await import('node:child_process');

        // Load .env from monorepo root
        const envPath = path.join(monorepoRoot, '.env');
        const envVars = { ...process.env };
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                if (line.trim().startsWith('#')) return;
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let val = match[2].trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    envVars[key] = val;
                }
            });
            console.log(chalk.dim('🔑 Loaded environment from .env'));
        }

        const args = ['ts-node', syncScript];
        if (options.initialize || options.force) {
            args.push('--initialize');
        }

        const result = spawnSync('npx', args, {
            cwd: serverDir,
            stdio: 'inherit',
            env: envVars,
        });

        if (result.status === 0) {
            console.log(chalk.green('\n✅ Memory indexed successfully!'));
        } else {
            console.error(chalk.red(`\n❌ Indexing failed with exit code ${result.status}`));
            process.exit(result.status || 1);
        }
    });

memoryCommand
    .command('migrate')
    .description('Reorganize the memory folder structure into alphabetical subfolders and update frontmatter tags')
    .option('--dry-run', 'Show what would be moved without actually making changes')
    .option('--only-one', 'Only migrate one note and stop (for testing)')
    .option('--only-ten', 'Only migrate ten notes and stop (for testing)')
    .action(async (options) => {
        const monorepoRoot = process.cwd();
        const serverDir = path.join(monorepoRoot, 'apps', 'elo-server');
        const migrateScript = path.join(serverDir, 'src', 'scripts', 'migrate-memory.ts');

        if (!fs.existsSync(migrateScript)) {
            console.error(chalk.red(`\n❌ migrate-memory.ts not found at: ${migrateScript}`));
            process.exit(1);
        }

        console.log(chalk.cyan('\n🚀 Starting memory migration...'));
        if (options.dryRun) {
            console.log(chalk.yellow('🔍 Dry run enabled: no files will be moved.'));
        }

        const { spawnSync } = await import('node:child_process');

        // Load .env
        const envPath = path.join(monorepoRoot, '.env');
        const envVars = { ...process.env };
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) envVars[match[1].trim()] = match[2].trim();
            });
        }

        const args = ['ts-node', migrateScript];
        if (options.dryRun) {
            args.push('--dry-run');
        }
        if (options.onlyOne) {
            args.push('--only-one');
        }
        if (options.onlyTen) {
            args.push('--only-ten');
        }

        const result = spawnSync('npx', args, {
            cwd: serverDir,
            stdio: 'inherit',
            env: envVars,
        });

        if (result.status === 0) {
            console.log(chalk.green('\n✅ Migration completed successfully!'));
        } else {
            console.error(chalk.red(`\n❌ Migration failed.`));
            process.exit(result.status || 1);
        }
    });

const dbCommand = new Command('db')
    .description('Manage the vector database');

dbCommand
    .command('search <text>')
    .description('Search the vector database for a text')
    .action(async (text) => {
        const monorepoRoot = process.cwd();
        const serverDir = path.join(monorepoRoot, 'apps', 'elo-server');
        const searchScript = path.join(serverDir, 'src', 'scripts', 'search-rag.ts');

        if (!fs.existsSync(searchScript)) {
            console.error(chalk.red(`\n❌ search-rag.ts not found at: ${searchScript}`));
            console.error(chalk.dim('Make sure you run this command from the monorepo root.'));
            process.exit(1);
        }

        console.log(chalk.cyan(`\n🔍 Searching database for: "${text}"...`));

        const { spawnSync } = await import('node:child_process');

        // Load .env from monorepo root
        const envPath = path.join(monorepoRoot, '.env');
        const envVars = { ...process.env };
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                if (line.trim().startsWith('#')) return;
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let val = match[2].trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    envVars[key] = val;
                }
            });
            console.log(chalk.dim('🔑 Loaded environment from .env'));
        }

        const result = spawnSync('npx', ['ts-node', searchScript, text], {
            cwd: serverDir,
            stdio: 'inherit',
            env: envVars,
        });

        if (result.status !== 0) {
            console.error(chalk.red(`\n❌ Search failed with exit code ${result.status}`));
            process.exit(result.status || 1);
        }
    });

dbCommand
    .command('delete [title]')
    .description('Delete a specific note or all chunks from the vector database')
    .option('-a, --all', 'Delete ALL notes from the database')
    .action(async (title, options) => {
        if (!title && !options.all) {
            console.error(chalk.red('\n❌ Error: Please provide a note title or use the --all flag.'));
            console.log(chalk.dim('Usage: elo memory db delete "My Note"'));
            console.log(chalk.dim('Usage: elo memory db delete --all\n'));
            process.exit(1);
        }

        const monorepoRoot = process.cwd();
        const serverDir = path.join(monorepoRoot, 'apps', 'elo-server');
        const deleteScript = path.join(serverDir, 'src', 'scripts', 'delete-note-rag.ts');

        if (!fs.existsSync(deleteScript)) {
            console.error(chalk.red(`\n❌ delete-note-rag.ts not found at: ${deleteScript}`));
            process.exit(1);
        }

        const target = options.all ? 'EVERYTHING' : `note: "${title}"`;
        console.log(chalk.cyan(`\n🔍 Deleting ${target} from database...`));

        const { spawnSync } = await import('node:child_process');

        // Load .env
        const envPath = path.join(monorepoRoot, '.env');
        const envVars = { ...process.env };
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) envVars[match[1].trim()] = match[2].trim();
            });
        }

        const args = ['ts-node', deleteScript];
        if (options.all) {
            args.push('--all');
        } else {
            args.push(title);
        }

        const result = spawnSync('npx', args, {
            cwd: serverDir,
            stdio: 'inherit',
            env: envVars,
        });

        if (result.status !== 0) {
            console.error(chalk.red(`\n❌ Deletion failed.`));
            process.exit(result.status || 1);
        }
        
        console.log(chalk.green(`\n✅ Deletion successful!`));
    });

dbCommand
    .command('clear')
    .description('Clear all entries from the vector database')
    .action(async () => {
        // Just call the delete command with --all logic
        const monorepoRoot = process.cwd();
        const serverDir = path.join(monorepoRoot, 'apps', 'elo-server');
        const deleteScript = path.join(serverDir, 'src', 'scripts', 'delete-note-rag.ts');

        console.log(chalk.yellow('\n🔥 Clearing entire vector database...'));

        const { spawnSync } = await import('node:child_process');
        const result = spawnSync('npx', ['ts-node', deleteScript, '--all'], {
            cwd: serverDir,
            stdio: 'inherit',
            env: process.env, // Simplified for brevity in clear command
        });

        if (result.status === 0) {
            console.log(chalk.green('\n✅ Database cleared!'));
        } else {
            process.exit(result.status || 1);
        }
    });

memoryCommand.addCommand(dbCommand);
