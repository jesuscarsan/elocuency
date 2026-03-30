import { StateGraph, END, START, Annotation, MemorySaver } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatMessage } from '../../../domain/Entities/ChatSession';
import { ChatIntent, ChatCategory } from '../../../domain/Entities/ChatIntent';
import { LoggerPort } from '../../../domain/ports/LoggerPort';
import { VectorDbPort } from '../../../domain/ports/VectorDbPort';
import { WebSearchPort } from '../../../domain/ports/WebSearchPort';
import { GenerateNoteAIUseCase } from '../../../application/UseCases/GenerateNoteAIUseCase';
import { ROUTER_SYSTEM_PROMPT } from '../../Prompts/IntentAnalyzerPrompts';
import { ASK_OBSIDIAN_PROMPT, GENERAL_CHAT_PROMPT } from '../../Prompts/SpecialistProcessorPrompts';
import { z } from 'zod';

/**
 * The state of for the Master Conversation Graph.
 */
export const MasterConversationState = Annotation.Root({
  input: Annotation<string>(),
  history: Annotation<ChatMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  userId: Annotation<string>(),
  intent: Annotation<ChatCategory>(),
  extractedContext: Annotation<string>(),
  response: Annotation<string>(),
  status: Annotation<'analyzing' | 'routing' | 'executing' | 'completed' | 'error'>(),
  traces: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type MasterConversationStateType = typeof MasterConversationState.State;

export class MasterConversationGraph {
  constructor(
    private readonly llm: BaseChatModel,
    private readonly vectorDb: VectorDbPort,
    private readonly webSearch: WebSearchPort,
    private readonly generateNoteAIUseCase: GenerateNoteAIUseCase,
    private readonly logger: LoggerPort
  ) {}

  /**
   * Node: analyze_intent
   * Replaces LangChainIntentAnalyzerAdapter.
   */
  private async analyzeIntent(state: MasterConversationStateType) {
    const intentSchema = z.object({
      intent: z.nativeEnum(ChatCategory).describe('The core intention of the user.'),
      extracted_context: z.string().describe('Names, files or queries extracted.'),
    });

    const extractionLLM = this.llm.withStructuredOutput(intentSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', ROUTER_SYSTEM_PROMPT],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);

    const chain = prompt.pipe(extractionLLM);
    
    // Map history to BaseMessage format for LangChain
    const formattedHistory = state.history.map(m => ({
      role: m.role === 'assistant' ? 'ai' : 'human',
      content: m.content
    }));

    const result = await chain.invoke({
      input: state.input,
      history: formattedHistory
    });

    this.logger.debug(`[MasterGraph] analyzeIntent Result: ${JSON.stringify(result)}`);
    const trace = `[Analyze] Intent: ${result.intent} | Context: ${result.extracted_context}`;
    this.logger.info(`[MasterGraph] ${trace}`);

    return { 
      intent: result.intent,
      extractedContext: result.extracted_context,
      status: 'routing' as const,
      traces: [trace]
    };
  }

  /**
   * Node: memory_qa
   * Handles asking memory questions (AskMemory intent).
   */
  private async memoryQAAction(state: MasterConversationStateType) {
    const searchStr = state.extractedContext || state.input;
    const traceSearch = `[MemoryQA] Searching memory for: "${searchStr}"`;
    this.logger.info(`[MasterGraph] ${traceSearch}`);

    const results = await this.vectorDb.search(searchStr, 5);

    const contextStr = results
      .map(r => `Source: ${r.metadata?.path || 'Unknown'}\nContent:\n${r.content}`)
      .join('\n\n');

    const historyStr = state.history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = ASK_OBSIDIAN_PROMPT
      .replace('{contextStr}', contextStr)
      .replace('{history}', historyStr || 'No previous history.')
      .replace('{original_input}', state.input);

    const res = await this.llm.invoke(prompt);
    
    const traceRes = `[MemoryQA] Generated response based on ${results.length} search results.`;
    this.logger.info(`[MasterGraph] ${traceRes}`);

    return { 
      response: res.content.toString(),
      status: 'completed' as const,
      traces: [traceSearch, traceRes]
    };
  }

  /**
   * Node: create_note_node
   * Wrapper for the existing NoteCreatorGraph via the Use Case.
   */
  private async createNoteAction(state: MasterConversationStateType) {
    const traceStart = `[CreateNote] Executing GenerateNoteAIUseCase for input: "${state.input}"`;
    this.logger.info(`[MasterGraph] ${traceStart}`);

    const result = await this.generateNoteAIUseCase.execute(state.input, state.userId);

    let response: string;
    let traceResult: string;

    if (result.status === 'success' && result.notes) {
      const notesLinks = result.notes.map(n => `[[${n.title}]]`).join(', ');
      response = `Entry registered in diary and inbox note created: ${notesLinks}`;
      traceResult = `[CreateNote] Successfully created ${result.notes.length} notes: ${notesLinks}`;
    } else {
      response = `[CREATE NOTE ERROR]: ${result.message || 'Unknown error'}`;
      traceResult = `[CreateNote] Error: ${result.message || 'Unknown error'}`;
    }

    this.logger.info(`[MasterGraph] ${traceResult}`);

    return { 
      response,
      status: 'completed' as const,
      traces: [traceStart, ...(result.traces || []), traceResult]
    };
  }

  /**
   * Node: web_search
   * Performs a web search and returns formatted results.
   */
  private async webSearchAction(state: MasterConversationStateType) {
    const query = state.extractedContext || state.input;
    const trace = `[WebSearch] Searching for: "${query}"`;
    this.logger.info(`[MasterGraph] ${trace}`);

    try {
      const results = await this.webSearch.search(query, 5);
      const formatted = results.map(r => `**${r.title}**\n${r.snippet}\n${r.link}`).join('\n\n');
      const response = results.length > 0 ? formatted : 'No results found.';
      const traceRes = `[WebSearch] Returned ${results.length} results.`;
      this.logger.info(`[MasterGraph] ${traceRes}`);
      return { response, status: 'completed' as const, traces: [trace, traceRes] };
    } catch (e) {
      this.logger.error(`[MasterGraph] WebSearch failed: ${e}`);
      return { response: 'Web search failed. Please try again later.', status: 'error' as const, traces: [trace] };
    }
  }

  /**
   * Node: general_chat
   * Standard LLM response.
   */
  private async generalChatAction(state: MasterConversationStateType) {
    const trace = `[GeneralChat] Routing to standard LLM response.`;
    this.logger.info(`[MasterGraph] ${trace}`);

    const messages = [
      { role: 'system', content: GENERAL_CHAT_PROMPT },
      ...state.history.map(m => ({
        role: m.role === 'assistant' ? 'ai' : 'human',
        content: m.content
      })),
      { role: 'human', content: state.input }
    ];
    
    const res = await this.llm.invoke(messages);
    const contentText = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    this.logger.debug(`[MasterGraph] general_chat LLM Response: ${contentText.substring(0, 100)}`);
    
    const traceRes = `[GeneralChat] Generated standard LLM response (${contentText.substring(0, 50)}...)`;
    this.logger.info(`[MasterGraph] ${traceRes}`);
    
    return { 
      response: contentText,
      status: 'completed' as const,
      traces: [trace, traceRes]
    };
  }

  public createGraph() {
    const checkpointer = new MemorySaver();
    
    const workflow = new StateGraph(MasterConversationState)
      .addNode('analyze_intent', this.analyzeIntent.bind(this))
      .addNode('memory_qa', this.memoryQAAction.bind(this))
      .addNode('create_note', this.createNoteAction.bind(this))
      .addNode('web_search', this.webSearchAction.bind(this))
      .addNode('general_chat', this.generalChatAction.bind(this))

      .addEdge(START, 'analyze_intent')

      .addConditionalEdges('analyze_intent', (state) => {
        switch (state.intent) {
          case ChatCategory.AskMemory:
            return 'memory_qa';
          case ChatCategory.CreateNote:
          case ChatCategory.ModifyMemory:
            return 'create_note';
          case ChatCategory.WebSearch:
            return 'web_search';
          case ChatCategory.ExecuteAction:
            this.logger.warn('[MasterGraph] ExecuteAction not implemented, falling back to general_chat');
            return 'general_chat';
          default:
            return 'general_chat';
        }
      })

      .addEdge('memory_qa', END)
      .addEdge('create_note', END)
      .addEdge('web_search', END)
      .addEdge('general_chat', END);

    return workflow.compile({ checkpointer });
  }
}
