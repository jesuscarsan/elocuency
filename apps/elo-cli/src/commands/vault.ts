import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

export const vaultCommand = new Command('vault')
    .description('Manage the Obsidian vault via Elo Server');

vaultCommand
    .command('init')
    .description('Initialize the vault with fundamental templates and structure')
    .option('-l, --lang <lang>', 'Language for the vault templates (es, en)', 'es')
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

        console.log(chalk.cyan(`\n📦 Initializing Vault...`));
        await checkHost();

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            console.log(chalk.dim(`📤 Sending vault init request to: ${serverUrl}/api/vault/init (lang: ${options.lang})`));

            const response = await fetch(`${serverUrl}/api/vault/init`, {
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

vaultCommand
    .command('index')
    .description('Index the Obsidian vault into the vector database for semantic search')
    .option('-f, --force', 'Force a full re-index of the entire vault')
    .action(async (options) => {
        const monorepoRoot = process.cwd();
        const serverDir = path.join(monorepoRoot, 'apps', 'elo-server');
        const syncScript = path.join(serverDir, 'src', 'scripts', 'sync-vault.ts');

        if (!fs.existsSync(syncScript)) {
            console.error(chalk.red(`\n❌ sync-vault.ts not found at: ${syncScript}`));
            console.error(chalk.dim('Make sure you run this command from the monorepo root.'));
            process.exit(1);
        }

        console.log(chalk.cyan('\n🔍 Indexing Obsidian vault into vector database...'));
        if (options.force) {
            console.log(chalk.yellow('⚡ Force mode: re-indexing all notes.'));
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

        const result = spawnSync('npx', ['ts-node', syncScript], {
            cwd: serverDir,
            stdio: 'inherit',
            env: envVars,
        });

        if (result.status === 0) {
            console.log(chalk.green('\n✅ Vault indexed successfully!'));
        } else {
            console.error(chalk.red(`\n❌ Indexing failed with exit code ${result.status}`));
            process.exit(result.status || 1);
        }
    });
