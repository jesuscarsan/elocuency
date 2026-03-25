import { z } from 'zod';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { NoteGeneratorPort, TemplateContext, NoteGenerationResult } from '../../domain/ports/NoteGeneratorPort';

export class LangChainNoteGeneratorAdapter implements NoteGeneratorPort {
  private getLLM(apiKey?: string, temperature: number = 0) {
    const modelName = process.env.BASIC_AI_MODEL || 'gemini-2.0-flash';
    if (modelName.includes('gemini') || modelName.includes('google')) {
      return new ChatGoogleGenerativeAI({
        model: modelName,
        temperature,
        apiKey: apiKey || process.env.GOOGLE_AI_API_KEY,
      });
    } else {
      return new ChatOpenAI({
        modelName: modelName || 'gpt-4o-mini',
        temperature,
        openAIApiKey: apiKey || process.env.OPENAI_API_KEY,
      });
    }
  }

  public async classifyTemplate(prompt: string, templates: TemplateContext[]): Promise<string | null> {
    const classificationSchema = z.object({
      templatePath: z.string().nullable().describe('The path of the most suitable template from the list, or null if none fit the request.'),
      reasoning: z.string().describe('Brief reasoning for why this template was selected.'),
    });

    const llm = this.getLLM(undefined, 0).withStructuredOutput(classificationSchema);

    const systemPrompt = `You are a note categorization assistant. 
Given a user's prompt to create a new note, your task is to select the BEST template from the provided list.
If none of the templates remotely fit the user's request, return null for the template path.

Available Templates:
{templatesString}

Analyze the user's prompt and select the most appropriate template path.`;

    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', '{prompt}'],
    ]);

    const chain = promptTemplate.pipe(llm);
    
    const templatesString = templates.map(t => `- Path: ${t.path}\n  Description: ${t.description}`).join('\n\n');

    const result = await chain.invoke({
      templatesString,
      prompt,
    }) as { templatePath: string | null; reasoning: string };

    console.log(`[Note Classification] Reasoning: ${result.reasoning}`);
    return result.templatePath;
  }

  public async generateNoteContent(prompt: string, templateContent: string): Promise<NoteGenerationResult> {
    const generationSchema = z.object({
      title: z.string().describe('A suitable file name/title for the note (without .md extension). Use Title Case or appropriate formatting.'),
      content: z.string().describe('The complete, newly generated markdown note. You MUST include and fill the YAML frontmatter based on the provided template, and then write the note body.'),
    });

    const llm = this.getLLM(undefined, 0.4).withStructuredOutput(generationSchema);

    const systemPrompt = `You are an expert note-taking assistant.
Your task is to craft a complete markdown note based on the user's request and the provided template.

Instructions:
1. STRICTLY adhere to the structure of the provided template.
2. Ensure the YAML frontmatter (between --- and ---) is included at the very top.
3. Fill out the frontmatter fields using information extracted from the user's prompt (or leave blank if unknown). Do NOT remove existing fields from the template.
4. After the frontmatter, write the main body of the note addressing the user's request. Format it nicely using markdown.
5. Create an appropriate file title.

Template content (please fill this out):
{templateContent}`;

    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', '{prompt}'],
    ]);

    const chain = promptTemplate.pipe(llm);

    const result = await chain.invoke({
      templateContent,
      prompt,
    }) as NoteGenerationResult;

    return result;
  }
}
