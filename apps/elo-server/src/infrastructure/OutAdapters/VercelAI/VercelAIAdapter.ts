import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LLMServicePort, AskAIRequest, AskAIResponse } from '../../../domain/ports/LLMServicePort';

export class VercelAIAdapter implements LLMServicePort {
  constructor(private readonly modelName: string = 'gpt-4o') {}

  private getModel() {
    if (this.modelName.startsWith('gemini')) {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
      });
      return google(this.modelName);
    }
    if (this.modelName.startsWith('claude')) {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      return anthropic(this.modelName);
    }
    return openai(this.modelName);
  }

  public async ask(request: AskAIRequest): Promise<AskAIResponse> {
    const aiMessages = request.messages.map(msg => ({
      role: msg.role === 'tool' ? 'system' : msg.role, // Simple mapping
      content: msg.content
    }));

    const result = await generateText({
      model: this.getModel(),
      system: request.systemPrompt,
      messages: aiMessages as any[],
    });

    return {
      content: result.text,
      usage: {
        promptTokens: (result.usage as any).promptTokens,
        completionTokens: (result.usage as any).completionTokens,
        totalTokens: (result.usage as any).totalTokens
      }
    };
  }

  public async stream(request: AskAIRequest, onToken: (token: string) => void): Promise<AskAIResponse> {
    const aiMessages = request.messages.map(msg => ({
      role: msg.role === 'tool' ? 'system' : msg.role,
      content: msg.content
    }));

    const result = await streamText({
      model: this.getModel(),
      system: request.systemPrompt,
      messages: aiMessages as any[],
    });

    for await (const delta of result.textStream) {
      onToken(delta);
    }

    const { usage } = await result;

    return {
      content: await result.text,
      usage: {
        promptTokens: (usage as any).promptTokens,
        completionTokens: (usage as any).completionTokens,
        totalTokens: (usage as any).totalTokens
      }
    };
  }
}
