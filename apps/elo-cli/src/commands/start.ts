import { Command } from "commander";
import { execSync } from "node:child_process";
import chalk from "chalk";

export const startCommand = new Command("start")
    .description("Launch Elo environment (Docker or Dev)")
    .option("-d, --dev", "Launch in development mode instead of Docker production mode")
    .action((options) => {
        if (options.dev) {
            console.log(chalk.cyan("🚀 Starting Elo in DEVELOPMENT mode..."));
            // TODO: Implement dev start logic
        } else {
            console.log(chalk.blue("🐳 Starting Elo in DOCKER mode..."));
            try {
                execSync("docker compose -f setup/docker-compose.yml up -d", { stdio: "inherit" });
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
