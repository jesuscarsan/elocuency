import { Command } from 'commander';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import chalk from 'chalk';

export const chatCommand = new Command('chat')
    .description('Start an interactive chat session with the AI')
    .option('-u, --user-id <id>', 'Specify a user ID for the session')
    .action(async (options) => {
        const userId = options.userId || randomBytes(4).toString('hex');
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
        let agentUrl = 'http://localhost:8001/agent/stream';
        let hostChecked = false;

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

                    console.log(chalk.dim(`   - Trying ${baseUrl}...`));
                    const res = await fetch(baseUrl, {
                        method: 'GET',
                        signal: controller.signal
                    });

                    clearTimeout(timeout);
                    if (res.status === 200 || res.status === 404) {
                        agentUrl = `${baseUrl}/agent/stream`;
                        console.log(chalk.green(`📡 Connection established via: ${baseUrl}\n`));
                        return;
                    } else {
                        console.log(chalk.dim(`   - ${baseUrl} responded with status: ${res.status}`));
                    }
                } catch (e) {
                    const error = e as Error;
                    console.log(chalk.dim(`   - ${baseUrl} failed: ${error.name === 'AbortError' ? 'Timeout' : error.message}`));
                }
            }
            console.log(chalk.yellow(`⚠️  Server not reached at localhost:8001 or host.docker.internal:8001.`));
            console.log(chalk.dim(`Defaulting to: ${agentUrl}\n`));
        };

        console.log(chalk.cyan(`\n💬 Connecting to Elo Server...`));
        if (authToken) {
            console.log(chalk.dim(`🔑 Auth token status: Loaded.`));
        } else {
            console.log(chalk.yellow(`⚠️  No SERVER_AUTH_TOKEN found. Connection might fail.`));
        }
        console.log(chalk.dim(`User ID: ${userId}`));

        await checkHost();

        console.log(chalk.yellow(`Type 'exit' or 'quit' to stop, 'cls' to clear screen.\n`));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.bold.blue('User: '),
        });

        rl.prompt();

        rl.on('line', async (line) => {
            const prompt = line.trim();

            if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
                rl.close();
                return;
            }

            if (prompt.toLowerCase() === 'cls') {
                console.clear();
                rl.prompt();
                return;
            }

            if (!prompt) {
                rl.prompt();
                return;
            }

            // Host check is now handled proactively before the loop

            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                };

                if (authToken) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }

                console.log(chalk.dim(`📤 Sending prompt to: ${agentUrl}`));
                const response = await fetch(agentUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        input: {
                            messages: [{ type: 'human', content: prompt }],
                        },
                        config: {
                            configurable: { thread_id: userId },
                        },
                    }),
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        throw new Error(`Authentication failed (HTTP ${response.status}). Check your SERVER_AUTH_TOKEN.`);
                    }
                    throw new Error(`Server error: ${response.statusText} (${response.status})`);
                }

                process.stdout.write(chalk.bold.green('AI: '));

                const reader = response.body?.getReader();
                if (!reader) throw new Error('Response body is null');

                const decoder = new TextDecoder();
                let aiMessage = '';

                let partialLine = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = (partialLine + chunk).split('\n');

                    // The last element is a partial line (or empty string if chunk ended with \n)
                    partialLine = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        if (line.startsWith('data: ')) {
                            try {
                                const dataStr = line.slice(6);
                                const data = JSON.parse(dataStr);

                                // Handle various LangServe/LangGraph stream formats
                                let content = '';

                                if (typeof data === 'string') {
                                    content = data;
                                } else if (data.content && typeof data.content === 'string') {
                                    content = data.content;
                                } else if (data.agent && data.agent.messages) {
                                    const lastMsg = data.agent.messages[data.agent.messages.length - 1];
                                    if (lastMsg.type === 'ai') content = lastMsg.content;
                                } else if (data.messages) {
                                    const lastMsg = data.messages[data.messages.length - 1];
                                    if (lastMsg.type === 'ai') content = lastMsg.content;
                                }

                                if (content && !aiMessage.includes(content)) {
                                    process.stdout.write(content);
                                    aiMessage += content;
                                }
                            } catch (e) {
                                // Ignore incomplete JSON
                            }
                        }
                    }
                }

                // Final check for any remaining data
                if (partialLine.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(partialLine.slice(6));
                        const content = typeof data === 'string' ? data : data.content;
                        if (content && !aiMessage.includes(content)) {
                            process.stdout.write(content);
                            aiMessage += content;
                        }
                    } catch (e) { }
                }
                process.stdout.write('\n\n');
            } catch (error) {
                console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
                if (agentUrl.includes('host.docker.internal')) {
                    console.log(chalk.dim('\nTip: On Mac/Windows Docker, make sure the server is bound to 0.0.0.0.'));
                }
            }

            rl.prompt();
        });

        rl.on('close', () => {
            console.log(chalk.yellow('\nGoodbye!'));
            process.exit(0);
        });
    });
