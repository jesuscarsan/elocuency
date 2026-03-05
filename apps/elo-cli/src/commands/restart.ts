import { Command } from "commander";
import { execSync } from "node:child_process";
import chalk from "chalk";

export const restartCommand = new Command("restart")
    .description("Restart Elo environment (Docker)")
    .action(() => {
        console.log(chalk.yellow("🔄 Restarting Elo environment..."));
        try {
            console.log(chalk.dim("Stopping..."));
            execSync("docker compose -f setup/docker-compose.yml down", { stdio: "inherit" });
            console.log(chalk.dim("Starting..."));
            execSync("docker compose -f setup/docker-compose.yml up -d", { stdio: "inherit" });
            console.log(chalk.green("\n✅ Elo environment restarted successfully!"));
        } catch (error) {
            console.error(chalk.red("\n❌ Failed to restart Elo environment:"), error instanceof Error ? error.message : String(error));
        }
    });
