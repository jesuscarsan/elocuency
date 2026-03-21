import * as fs from 'fs';
import * as path from 'path';

export interface N8nConfig {
  baseUrl: string;
  workflowsDir: string;
}

export class N8nAdapter {
  constructor(private readonly config: N8nConfig) {
    if (!fs.existsSync(config.workflowsDir)) {
      try {
        fs.mkdirSync(config.workflowsDir, { recursive: true });
      } catch (e) {
        console.warn(`Could not create workflows directory ${config.workflowsDir}:`, e);
      }
    }
  }

  public async triggerWorkflow(workflowName: string, data: Record<string, any>): Promise<string> {
    try {
      const filename = `${workflowName}.json`;
      let filepath = path.join(this.config.workflowsDir, filename);

      if (!fs.existsSync(filepath)) {
        if (!fs.existsSync(this.config.workflowsDir)) {
          return `Error: Workflows directory '${this.config.workflowsDir}' not found.`;
        }

        const allFiles = fs.readdirSync(this.config.workflowsDir);
        const found = allFiles.find(f => f.toLowerCase() === filename.toLowerCase());
        
        if (!found) {
          return `Error: Workflow '${workflowName}' not found in ${this.config.workflowsDir}.`;
        }
        filepath = path.join(this.config.workflowsDir, found);
      }

      const workflowDataStr = fs.readFileSync(filepath, 'utf-8');
      const workflowData = JSON.parse(workflowDataStr);

      let webhookPath: string | null = null;
      for (const node of (workflowData.nodes || [])) {
        if (node.type === 'n8n-nodes-base.webhook' || node.type === 'n8n-nodes-base.webhookPublic') {
          webhookPath = node.parameters?.path || null;
          break;
        }
      }

      if (!webhookPath) {
        return `Error: Workflow '${workflowName}' has no Webhook node.`;
      }

      // Ensure we format the URL correctly
      const url = new URL(`webhook/${webhookPath}`, this.config.baseUrl).toString();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const responseText = await response.text();

      if (response.ok) {
        return `Success: Workflow '${workflowName}' triggered. Response: ${responseText}`;
      } else {
        return `Error: Failed to trigger workflow. Status: ${response.status}, Response: ${responseText}`;
      }
    } catch (error: any) {
      console.error('Error triggering n8n workflow:', error);
      return `Error: ${error.message}`;
    }
  }

  public listWorkflows(): string[] {
    try {
      if (!fs.existsSync(this.config.workflowsDir)) {
        return [];
      }

      const files = fs.readdirSync(this.config.workflowsDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (e) {
      console.error('Error listing n8n workflows:', e);
      return [];
    }
  }

  public createWorkflow(workflowName: string, workflowJson: string): string {
    try {
      if (!fs.existsSync(this.config.workflowsDir)) {
        fs.mkdirSync(this.config.workflowsDir, { recursive: true });
      }

      const filename = workflowName.endsWith('.json') ? workflowName : `${workflowName}.json`;
      const filepath = path.join(this.config.workflowsDir, filename);

      const jsonObj = JSON.parse(workflowJson);
      fs.writeFileSync(filepath, JSON.stringify(jsonObj, null, 2));

      return `Success: Workflow '${workflowName}' created at ${filepath}.`;
    } catch (e: any) {
      console.error('Error creating n8n workflow:', e);
      return `Error creating workflow: ${e.message}`;
    }
  }
}
