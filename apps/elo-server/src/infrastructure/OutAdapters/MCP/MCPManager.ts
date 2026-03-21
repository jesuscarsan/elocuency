import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool } from 'ai';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';

export class MCPManager {
  private clients: Map<string, Client> = new Map();
  private workspacePaths: string[];

  constructor(workspacePaths: string[]) {
    this.workspacePaths = workspacePaths;
  }

  public async start(activatedMcps: Array<{ name: string; active: boolean }>) {
    for (const wsPath of this.workspacePaths) {
      if (!fs.existsSync(wsPath)) continue;

      const dirs = fs.readdirSync(wsPath, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'));

      for (const dir of dirs) {
        const serverName = dir.name;
        const config = activatedMcps.find(m => m.name === serverName);
        if (!config || !config.active) continue;

        const serverDir = path.join(wsPath, serverName);
        let command = '';
        let args: string[] = [];

        if (fs.existsSync(path.join(serverDir, 'dist', 'index.js'))) {
          command = 'node';
          args = [path.join(serverDir, 'dist', 'index.js')];
        } else if (fs.existsSync(path.join(serverDir, 'index.js'))) {
          command = 'node';
          args = [path.join(serverDir, 'index.js')];
        } else if (fs.existsSync(path.join(serverDir, 'src', serverName, 'server.py'))) {
          command = 'python3';
          args = [path.join(serverDir, 'src', serverName, 'server.py')];
        } else if (fs.existsSync(path.join(serverDir, 'src', 'server.py'))) {
          command = 'python3';
          args = [path.join(serverDir, 'src', 'server.py')];
        }

        if (command) {
          try {
            console.log(`Connecting to MCP server ${serverName}...`);
            const envVars = Object.fromEntries(
                Object.entries(process.env).filter(([_, v]) => v !== undefined)
            ) as Record<string, string>;

            const transport = new StdioClientTransport({
              command,
              args,
              env: envVars
            });

            const client = new Client(
              { name: 'elo-server', version: '1.0.0' },
              { capabilities: {} }
            );

            await client.connect(transport);
            this.clients.set(serverName, client);
            console.log(`Connected to MCP server ${serverName}`);
          } catch (e) {
            console.error(`Failed to connect to MCP ${serverName}`, e);
          }
        }
      }
    }
  }

  public async stop() {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (e) {
        console.error(`Error closing MCP client ${name}`, e);
      }
    }
    this.clients.clear();
  }

  public async getTools(): Promise<Record<string, any>> {
    const tools: Record<string, any> = {};

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const response = await client.listTools();
        const prefix = serverName.startsWith('mcp-') ? serverName.substring(4) : serverName;
        const safePrefix = prefix.replace(/-/g, '_');

        for (const mcpTool of response.tools) {
          const namespacedName = `${safePrefix}_${mcpTool.name}`;

          // Basic JSON schema to Zod mapping for tool parameters
          const props = (mcpTool.inputSchema as any)?.properties || {};
          const required = (mcpTool.inputSchema as any)?.required || [];
          
          const zodShape: any = {};
          for (const [key, val] of Object.entries<any>(props)) {
            let zType: any = z.any();
            if (val.type === 'string') zType = z.string();
            else if (val.type === 'number' || val.type === 'integer') zType = z.number();
            else if (val.type === 'boolean') zType = z.boolean();
            else if (val.type === 'object') zType = z.object({});
            else if (val.type === 'array') zType = z.array(z.any());

            if (val.description) zType = zType.describe(val.description);
            if (!required.includes(key)) zType = zType.optional();
            
            zodShape[key] = zType;
          }

          tools[namespacedName] = tool({
            description: `[MCP] ${mcpTool.description || ''}`,
            parameters: z.object(zodShape) as any,
            execute: async (args: any) => {
              try {
                const res = await client.callTool({
                   name: mcpTool.name,
                   arguments: args
                });
                
                if (res.isError) {
                   return `Error: ${JSON.stringify(res.content)}`;
                }
                
                return (res.content as any[]).map(c => c.type === 'text' ? c.text : '').join('\n');
              } catch (e: any) {
                return `Exception calling tool: ${e.message}`;
              }
            }
          } as any);
        }
      } catch (e) {
        console.error(`Failed to get tools from ${serverName}`, e);
      }
    }

    return tools;
  }
}
