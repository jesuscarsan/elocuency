import { LiveVoicePort, LiveVoiceSession } from '../../domain/ports/LiveVoicePort';
import { LoggerPort } from '../../domain/ports/LoggerPort';

export interface LiveChatOptions {
  model?: string;
  systemInstruction?: string;
  tools?: any[];
}

export class LiveVoiceChatUseCase {
  private voicePort: LiveVoicePort;
  private logger: LoggerPort;

  constructor(voicePort: LiveVoicePort, logger: LoggerPort) {
    this.voicePort = voicePort;
    this.logger = logger;
  }

  async execute(options: LiveChatOptions): Promise<LiveVoiceSession> {
    const session = await this.voicePort.createSession({
      model: options.model || 'gemini-2.0-flash-exp',
      systemInstruction: options.systemInstruction,
      tools: options.tools
    });

    session.onToolCall(async (toolCall: any) => {
      this.logger.info(`Gemini requested tool call: ${JSON.stringify(toolCall)}`);
      // Here we would dispatch to the ToolRegistry or actual UseCases.
      // For now, let's acknowledge and simulate a background task.
      
      const functionCall = toolCall.functionCalls[0];
      if (functionCall) {
         // Acknowledge to Gemini immediately so it can tell the user it's starting.
         session.sendToolResponse({
           functionResponses: [{
             name: functionCall.name,
             response: { result: "Task started in background." }
           }]
         });

         // Simulate background task completion
         setTimeout(() => {
           this.logger.info(`Background task ${functionCall.name} completed.`);
           // Send a proactive message to Gemini so it informs the user.
           session.sendText(`SYSTEM: The task '${functionCall.name}' has finished successfully. Please notify the user.`);
         }, 5000);
      }
    });

    return session;
  }
}
