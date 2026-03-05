import { Command } from "commander";
import { execSync } from "node:child_process";
import chalk from "chalk";

const watchCommand = new Command("watch")
    .description("Watch and auto-rebuild an application")
    .argument("<app>", "The name of the application to run dev on")
    .action((app) => {
        console.log(chalk.cyan(`👀 Starting watch mode for ${app}...`));
        try {
            // Use a robust shell configuration for pnpm execution
            const shell = process.env.SHELL || '/bin/sh';
            execSync(`pnpm --filter ${app} run dev`, {
                stdio: "inherit",
                env: {
                    ...process.env,
                    PATH: `${process.env.PATH}:/usr/local/bin` // Ensure common pnpm paths are included
                },
                shell
            });
        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to run dev watch for ${app}:`), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

export const devCommand = new Command("dev")
    .description("Development specific commands")
    .addCommand(watchCommand);
