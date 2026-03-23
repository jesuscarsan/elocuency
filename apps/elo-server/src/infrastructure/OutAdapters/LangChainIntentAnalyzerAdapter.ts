import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { IntentAnalyzerPort } from '../../domain/ports/IntentAnalyzerPort';
import { ChatIntent, ChatCategory } from '../../domain/Entities/ChatIntent';
import { ROUTER_SYSTEM_PROMPT } from '../Prompts/IntentAnalyzerPrompts';

export class LangChainIntentAnalyzerAdapter implements IntentAnalyzerPort {
  private routerPrompt: ChatPromptTemplate;
  private llmWithStructuredOutput: any; // We use 'any' strictly for internal chaining if typing gets messy, but let's try to type it

  constructor(apiKey?: string) {
    // 1. Define the strictly typed output schema using Zod
    const intentSchema = z.object({
      intent: z.nativeEnum(ChatCategory).describe('The core intention of the user.'),
      extracted_context: z.string().describe('Any specific names, files, or queries extracted from the prompt context.'),
    });

    // 2. Initialize the LLM dynamically
    const modelName = process.env.BASIC_AI_MODEL || 'gemini-2.0-flash';
    let llm: any;

    if (modelName.includes('gemini') || modelName.includes('google')) {
      llm = new ChatGoogleGenerativeAI({
        model: modelName,
        temperature: 0,
        apiKey: apiKey || process.env.GOOGLE_AI_API_KEY,
      });
    } else {
      llm = new ChatOpenAI({
        modelName: modelName || 'gpt-4o-mini',
        temperature: 0,
        openAIApiKey: apiKey || process.env.OPENAI_API_KEY,
      });
    }

    // 3. Bind the structured output schema
    this.llmWithStructuredOutput = llm.withStructuredOutput(intentSchema);

    // 4. Create the routing system prompt
    this.routerPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        ROUTER_SYSTEM_PROMPT,
      ],
      ['human', '{input}'],
    ]);
  }

  public async analyze(message: string): Promise<ChatIntent> {
    const intentAnalyzerChain = this.routerPrompt.pipe(this.llmWithStructuredOutput);
    
    // The chain returns an object matching the Zod schema
    const result = await intentAnalyzerChain.invoke({ input: message }) as any;
    
    return {
      intent: result.intent,
      extracted_context: result.extracted_context,
    };
  }
}
