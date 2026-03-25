import { IntentAnalyzerPort } from '../../domain/ports/IntentAnalyzerPort';
import { SpecialistProcessorPort } from '../../domain/ports/SpecialistProcessorPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';

export interface RouteChatMessageRequest {
  message: string;
}

export interface RouteChatMessageResponse {
  intent: string;
  response: string;
}

export class RouteChatMessageUseCase {
  constructor(
    private readonly intentAnalyzer: IntentAnalyzerPort,
    private readonly specialistProcessor: SpecialistProcessorPort,
    private readonly logger: LoggerPort
  ) {}


  public async execute(request: RouteChatMessageRequest): Promise<RouteChatMessageResponse> {
    // 1. Analyze the core intent of the message
    const chatIntent = await this.intentAnalyzer.analyze(request.message);

    // 2. Route the execution to the assigned specialist sub-graph/chain
    const response = await this.specialistProcessor.process(chatIntent, request.message);

    return {
      intent: chatIntent.intent,
      response,
    };
  }
}
