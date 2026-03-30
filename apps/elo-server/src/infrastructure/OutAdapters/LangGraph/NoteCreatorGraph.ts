import { z } from 'zod';
import { StateGraph, END, START, Annotation, MemorySaver } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatMessage } from '../../../domain/Entities/ChatSession';
import { LoggerPort } from '../../../domain/ports/LoggerPort';
import { GENERATE_DIARY_ENTRY_PROMPT } from '../../Prompts/NoteCreatorPrompts';

/**
 * The state of our LangGraph for note creation.
 */
export const NoteCreatorState = Annotation.Root({
  originalPrompt: Annotation<string>(),
  history: Annotation<ChatMessage[]>(),
  diaryEntry: Annotation<string | null>(),
  distilledFacts: Annotation<string | null>(),
  status: Annotation<'generating' | 'success' | 'error'>(),
  errorMessage: Annotation<string | null>(),
  traces: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type NoteCreatorStateType = typeof NoteCreatorState.State;

export class NoteCreatorGraph {
  constructor(
    private readonly llm: BaseChatModel,
    private readonly logger: LoggerPort
  ) { }

  /**
   * Node: generate_diary_entry
   * Transforms the original user prompt into a first-person chronological diary entry.
   */
  private async generateDiaryEntry(state: NoteCreatorStateType) {
    const generationSchema = z.object({
      entry: z.string().describe("The reformulated first-person diary entry."),
      distilledFacts: z.string().describe("A clean, concise list or summary of ONLY the pure facts/entities to be annotated, removing all conversational words and fluff.")
    });

    const generator = this.llm.withStructuredOutput(generationSchema);

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', GENERATE_DIARY_ENTRY_PROMPT],
      ['human', '{input}']
    ]);

    const chain = prompt.pipe(generator);
    const result = await chain.invoke({ input: state.originalPrompt });

    const trace = `[Diary] Rewrote prompt as diary entry: "${result.entry.substring(0, 50)}..."`;
    this.logger.info(`[NoteCreator] ${trace}`);

    return {
      diaryEntry: result.entry,
      distilledFacts: result.distilledFacts,
      status: 'success' as const,
      traces: [trace]
    };
  }

  public createGraph() {
    const checkpointer = new MemorySaver();

    const workflow = new StateGraph(NoteCreatorState)
      .addNode('generate_diary_entry', this.generateDiaryEntry.bind(this))
      .addEdge(START, 'generate_diary_entry')
      .addEdge('generate_diary_entry', END);

    return workflow.compile({ checkpointer });
  }
}
