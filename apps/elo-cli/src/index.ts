import { Command } from 'commander';
import { serverCommand } from './commands/server.js';
import { mcpCommand } from './commands/mcp.js';
import { completionCommand } from './commands/completion.js';
import { chatCommand } from './commands/chat.js';
import { devCommand } from './commands/dev.js';
import { memoryCommand } from './commands/memory.js';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const { version } = packageJson;

const program = new Command();

program
	.name('elo')
	.description('Elo Monorepo CLI utility for managing the project')
	.version(version);

// Register commands
program.addCommand(serverCommand);
program.addCommand(mcpCommand);
program.addCommand(completionCommand);
program.addCommand(chatCommand);
program.addCommand(devCommand);
program.addCommand(memoryCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no arguments are provided
if (!process.argv.slice(2).length) {
	program.outputHelp();
}
