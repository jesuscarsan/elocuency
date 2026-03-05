import { Command } from 'commander';
import * as crypto from 'node:crypto';
import chalk from 'chalk';

export const generateTokenCommand = new Command('generate-token')
    .description('Generate a secure, random authentication token for the Elo Server')
    .action(() => {
        // Generate a 32-byte (64-character hex) random token
        const token = crypto.randomBytes(32).toString('hex');

        console.log(chalk.green('\n✅ Secure Token Generated:\n'));
        console.log(chalk.bold.cyan(token));
        console.log('\n');
        console.log(chalk.yellow('Instructions:'));
        console.log(`1. Copy this token.`);
        console.log(`2. Paste it into your ${chalk.bold('setup/.env')} file like this:`);
        console.log(chalk.dim(`   SERVER_AUTH_TOKEN=${token}`));
        console.log(`3. Restart your server for the changes to take effect: ${chalk.bold('elo server restart')}`);
        console.log(
            `4. Save this token in your Obsidian Elocuency Settings.\n`,
        );
    });
