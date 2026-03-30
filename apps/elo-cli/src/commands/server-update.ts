import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

const parseEnvFile = (filePath: string): Record<string, string> => {
    if (!existsSync(filePath)) return {};
    const content = readFileSync(filePath, 'utf-8');
    const env: Record<string, string> = {};
    content.split('\n').forEach(line => {
        if (line.trim().startsWith('#')) return;
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim();
        }
    });
    return env;
};

export const serverUpdateCommand = new Command("update")
    .description("Update the database schema to the latest version")
    .action(() => {
        const monorepoRoot = process.env.PWD?.includes('apps/elo-cli') 
            ? process.env.PWD.split('/apps/elo-cli')[0] 
            : process.env.PWD || process.cwd();

        const envPath = join(monorepoRoot, '.env');
        const fileEnv = parseEnvFile(envPath);
        const runtimeMode = fileEnv.ELO_RUNTIME_MODE || 'docker';

        console.log(chalk.cyan(`🔄 Preparing database migration (Mode: ${runtimeMode})...`));

        if (runtimeMode === 'docker') {
            console.log(chalk.blue("🐳 Executing migration inside elocuency-elo-server-1 container..."));
            const result = spawnSync("docker", [
                "exec", 
                "elocuency-elo-server-1", 
                "npx", 
                "ts-node", 
                "src/infrastructure/OutAdapters/Database/scripts/migrate.ts"
            ], { stdio: "inherit", cwd: monorepoRoot });

            if (result.status === 0) {
                console.log(chalk.green("\n✅ Database updated successfully!"));
            } else {
                console.error(chalk.red("\n❌ Migration failed. Check logs above."));
                process.exit(1);
            }
        } else {
            console.log(chalk.yellow("🚀 Executing migration in NATIVE mode..."));
            const result = spawnSync("npx", [
                "ts-node", 
                "src/infrastructure/OutAdapters/Database/scripts/migrate.ts"
            ], { 
                stdio: "inherit", 
                cwd: join(monorepoRoot, "apps/elo-server"),
                env: { ...process.env, ...fileEnv }
            });

            if (result.status === 0) {
                console.log(chalk.green("\n✅ Database updated successfully!"));
            } else {
                console.error(chalk.red("\n❌ Migration failed. Check logs above."));
                process.exit(1);
            }
        }
    });
