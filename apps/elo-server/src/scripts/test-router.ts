import { config } from 'dotenv';
import { LangChainIntentAnalyzerAdapter } from '../infrastructure/OutAdapters/LangChainIntentAnalyzerAdapter';
import { LangChainSpecialistProcessorAdapter } from '../infrastructure/OutAdapters/LangChainSpecialistProcessorAdapter';
import { RouteChatMessageUseCase } from '../application/UseCases/RouteChatMessageUseCase';
import { WinstonLoggerAdapter } from '../infrastructure/logging/WinstonLoggerAdapter';

config({ path: '../../.env' }); // Load environment variables from repo root

async function runTest() {
  console.log('--- Starting Semantic Router Test ---');
  
  const logger = new WinstonLoggerAdapter('test-router');

  // 1. Instantiate Adapters (Infrastructure Layer)
  const intentAnalyzer = new LangChainIntentAnalyzerAdapter(logger);
  const specialistProcessor = new LangChainSpecialistProcessorAdapter(undefined, undefined, logger);
  
  // 2. Instantiate Use Case (Application Layer)
  const routerUseCase = new RouteChatMessageUseCase(intentAnalyzer, specialistProcessor, logger);
  
  // 3. Test Cases
  const queries = [
    "I need to add a new note in my memory about the hexagonal architecture principles we just discussed.",
    "Can you retrieve my notes from memory about React performance?",
    "Search google to see what the weather is like in Madrid right now.",
    "Trigger the n8n workflow for sending the daily summary email.",
    "Hey! How is your day going? Tell me a quick joke."
  ];

  for (const query of queries) {
    console.log(`\nUser: "${query}"`);
    console.log('Processing...');
    
    try {
      const start = Date.now();
      const result = await routerUseCase.execute({ message: query });
      console.log(`Time: ${Date.now() - start}ms`);
      console.log(`Classified Intent: -> [${result.intent}]`);
      console.log(`System Output: -> ${result.response}`);
    } catch (e) {
      console.error(`Error processing query: ${e}`);
    }
  }
}

runTest();
