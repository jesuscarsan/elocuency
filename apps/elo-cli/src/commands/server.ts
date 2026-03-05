import { Command } from "commander";
import { startCommand } from "./start.js";
import { stopCommand } from "./stop.js";
import { restartCommand } from "./restart.js";
import { generateTokenCommand } from "./generate-token.js";

export const serverCommand = new Command("server")
    .description("Manage Elo server environment")
    .addCommand(startCommand)
    .addCommand(stopCommand)
    .addCommand(restartCommand)
    .addCommand(generateTokenCommand);
