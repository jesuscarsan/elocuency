import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { RunnableLambda, RunnableBranch, RunnableSequence } from '@langchain/core/runnables';
import { SpecialistProcessorPort } from '../../domain/ports/SpecialistProcessorPort';
import { ChatIntent, ChatCategory } from '../../domain/Entities/ChatIntent';
import { VectorDbPort } from '../../domain/ports/VectorDbPort';
import { SyncVaultUseCase } from '../../application/UseCases/SyncVaultUseCase';
import { ASK_OBSIDIAN_PROMPT, MODIFY_OBSIDIAN_PROMPT, WEB_SEARCH_PROMPT, ACTION_SCRIPT_PROMPT } from '../Prompts/SpecialistProcessorPrompts';

export class LangChainSpecialistProcessorAdapter implements SpecialistProcessorPort {
  private theMasterChain: Parameters<typeof RunnableBranch.from>[0] | any;

  constructor(
    private readonly syncVaultUseCase?: SyncVaultUseCase,
    private readonly vectorDb?: VectorDbPort,
    apiKey?: string
  ) {
    const modelName = process.env.BASIC_AI_MODEL || 'gemini-2.0-flash';
    let llm: any;

    if (modelName.includes('gemini') || modelName.includes('google')) {
      llm = new ChatGoogleGenerativeAI({
        model: modelName,
        temperature: 0.2,
        apiKey: apiKey || process.env.GOOGLE_AI_API_KEY,
      });
    } else {
      llm = new ChatOpenAI({
        modelName: modelName || 'gpt-4o',
        temperature: 0.2,
        openAIApiKey: apiKey || process.env.OPENAI_API_KEY,
      });
    }

    const syncUseCase = this.syncVaultUseCase;
    const vDb = this.vectorDb;

    const askObsidianChain = RunnableLambda.from(async (input: { original_input: string; context: string }) => {
      try {
        // On-demand sync before query
        if (syncUseCase) {
          const synced = await syncUseCase.execute();
          if (synced > 0) {
            console.log(`[Vault Sync] Synced ${synced} chunks before query.`);
          } else if (synced === -1) {
            console.log('[Vault Sync] Skipped (cooldown active).');
          }
        }

        if (!vDb) {
          return '[OBSIDIAN QA ERROR]: VectorDbPort not configured.';
        }

        const searchStr = input.context || input.original_input;
        const results = await vDb.search(searchStr, 5);

        const contextStr = results
          .map(r => `Source: ${r.metadata?.path || 'Unknown'}\nContent:\n${r.content}`)
          .join('\n\n');

        const prompt = ASK_OBSIDIAN_PROMPT
          .replace('{contextStr}', contextStr)
          .replace('{original_input}', input.original_input);

        const res = await llm.invoke(prompt);
        return res.content.toString();
      } catch (e: any) {
        return `[OBSIDIAN QA ERROR]: Failed to query vault. Error: ${e.message}`;
      }
    });

    const modifyObsidianChain = RunnableLambda.from(async (input: { original_input: string; context: string }) => {
      return MODIFY_OBSIDIAN_PROMPT.replace('{original_input}', input.original_input);
    });

    const webSearchChain = RunnableLambda.from(async (input: { original_input: string; context: string }) => {
      return WEB_SEARCH_PROMPT.replace('{context}', input.context);
    });

    const executeActionChain = RunnableLambda.from(async (input: { original_input: string; context: string }) => {
      return ACTION_SCRIPT_PROMPT.replace('{context}', input.context);
    });

    const generalChatChain = RunnableLambda.from(async (input: { original_input: string }) => {
      const res = await llm.invoke(input.original_input);
      return res.content.toString();
    });

    const routeExecution = RunnableBranch.from([
      [
        (x: ChatIntent & { original_input: string }) => x.intent === ChatCategory.AskObsidian,
        RunnableSequence.from([
          (x) => ({ original_input: x.original_input, context: x.extracted_context }),
          askObsidianChain,
        ]),
      ],
      [
        (x: ChatIntent & { original_input: string }) => x.intent === ChatCategory.ModifyObsidian,
        RunnableSequence.from([
          (x) => ({ original_input: x.original_input, context: x.extracted_context }),
          modifyObsidianChain,
        ]),
      ],
      [
        (x: ChatIntent & { original_input: string }) => x.intent === ChatCategory.WebSearch,
        RunnableSequence.from([
          (x) => ({ original_input: x.original_input, context: x.extracted_context }),
          webSearchChain,
        ]),
      ],
      [
        (x: ChatIntent & { original_input: string }) => x.intent === ChatCategory.ExecuteAction,
        RunnableSequence.from([
          (x) => ({ original_input: x.original_input, context: x.extracted_context }),
          executeActionChain,
        ]),
      ],
      // Fallback
      RunnableSequence.from([
        (x) => ({ original_input: x.original_input }),
        generalChatChain,
      ]),
    ]);

    this.theMasterChain = routeExecution;
  }

  public async process(intent: ChatIntent, message: string): Promise<string> {
    const payload = {
      intent: intent.intent,
      extracted_context: intent.extracted_context,
      original_input: message,
    };

    const response = await this.theMasterChain.invoke(payload);
    
    return String(response);
  }
}

