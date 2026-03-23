import { Command } from "commander";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

const parseEnvFile = (filePath: string): Record<string, string> => {
    if (!existsSync(filePath)) return {};
    const content = readFileSync(filePath, 'utf-8');
    const env: Record<string, string> = {};
    content.split('\n').forEach(line => {
        // Ignore lines that are comments or don't have '='
        if (line.trim().startsWith('#')) return;
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            } else if (val.startsWith("'") && val.endsWith("'")) {
                val = val.slice(1, -1);
            }
            env[key] = val;
        }
    });
    return env;
};

export const startCommand = new Command("start")
    .description("Launch Elo environment (Docker or Native)")
    .option("-d, --dev", "Force launch in development/native mode")
    .action((options) => {
        // Find monorepo root conceptually based on CLI execution
        const monorepoRoot = process.env.PWD?.includes('apps/elo-cli') 
            ? process.env.PWD.split('/apps/elo-cli')[0] 
            : process.env.PWD || process.cwd();

        const envArgs = { ...process.env };
        const envPath = join(monorepoRoot, '.env');
        const fileEnv = parseEnvFile(envPath);
        
        const runtimeMode = options.dev ? 'native' : (fileEnv.ELO_RUNTIME_MODE || 'docker');
        const combinedEnv = { ...envArgs, ...fileEnv };

        if (runtimeMode === 'native') {
            console.log(chalk.cyan("🚀 Starting Elo in NATIVE mode..."));
            console.log(chalk.yellow("Press Ctrl+C to stop all services.\n"));

            const activeProcesses: ReturnType<typeof spawn>[] = [];

            const createSpawner = (command: string, args: string[], cwd: string, prefixText: string, color: typeof chalk.cyan) => {
                console.log(color(`Starting ${prefixText}...`));
                const proc = spawn(command, args, { cwd, env: combinedEnv, stdio: ['ignore', 'pipe', 'pipe'] });
                
                proc.stdout?.on('data', (data) => process.stdout.write(color(`[${prefixText}] `) + data));
                proc.stderr?.on('data', (data) => process.stderr.write(chalk.red(`[${prefixText}] `) + data));
                proc.on('close', (code) => console.log(color(`[${prefixText}] exited with code ${code}`)));
                
                activeProcesses.push(proc);
            };

            // 1. Start elo-server (Always)
            createSpawner('npm', ['run', 'dev'], join(monorepoRoot, 'apps/elo-server'), 'elo-server', chalk.green);

            // 2. Start n8n
            if (combinedEnv.LOCAL_N8N_ENABLED === 'true') {
                createSpawner('npx', ['n8n', 'start'], monorepoRoot, 'n8n', chalk.magenta);
            }

            // 3. Start Caddy and Ngrok
            if (combinedEnv.LOCAL_CADDY_NGROK_ENABLED === 'true') {
                 createSpawner('caddy', ['run', '--config', 'Caddyfile'], join(monorepoRoot, 'setup'), 'caddy', chalk.blue);
                 createSpawner('ngrok', ['http', '80'], join(monorepoRoot, 'setup'), 'ngrok', chalk.cyan);
            }

            // Handle graceful shutdown
            process.on('SIGINT', () => {
                console.log(chalk.yellow("\n🛑 Stopping all local services..."));
                activeProcesses.forEach(p => p.kill('SIGINT'));
                console.log(chalk.green("✅ All services stopped."));
                process.exit(0);
            });

        } else {
            console.log(chalk.blue("🐳 Starting Elo in DOCKER mode..."));
            try {
                const composeArgs = ["compose", "--env-file", ".env", "-f", "setup/docker-compose.yml", "-f", "docker-compose.yml"];
                if (combinedEnv.LOCAL_N8N_ENABLED === 'true') {
                    composeArgs.push("--profile", "n8n");
                }
                composeArgs.push("up", "-d");

                spawnSync("docker", composeArgs, { 
                    cwd: monorepoRoot, 
                    stdio: "inherit",
                    env: combinedEnv 
                });
                console.log(chalk.green("\n✅ Elo environment is starting up!"));

                console.log(chalk.bold("\n🔌 Servicios y Puertos Disponibles:"));
                console.log(`   ${chalk.cyan("Elo Server API:")}            http://localhost:80`);
                console.log(`   ${chalk.cyan("Elo Server API (Directo):")}  http://localhost:8001`);
                console.log(`   ${chalk.cyan("Motor de Automatización n8n:")} http://localhost/n8n/`);
            } catch (error) {
                console.error(chalk.red("\n❌ Failed to start Elo environment:"), error instanceof Error ? error.message : String(error));
            }
        }
    });
