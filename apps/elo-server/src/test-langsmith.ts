import './env';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';

async function testTracing() {
  console.log('--- ENV CHECK ---');
  console.log('LANGCHAIN_TRACING_V2:', process.env.LANGCHAIN_TRACING_V2);
  console.log('LANGCHAIN_ENDPOINT:', process.env.LANGCHAIN_ENDPOINT);
  console.log('LANGCHAIN_PROJECT:', process.env.LANGCHAIN_PROJECT);
  console.log('LANGCHAIN_API_KEY:', process.env.LANGCHAIN_API_KEY ? `PRESENT (starts with: ${process.env.LANGCHAIN_API_KEY.substring(0, 10)})` : 'MISSING');
  console.log('BASIC_AI_MODEL:', process.env.BASIC_AI_MODEL);

  try {
    const modelName = process.env.BASIC_AI_MODEL || 'gemini-2.0-flash';
    let llm: any;

    if (modelName.includes('gemini') || modelName.includes('google')) {
      console.log('Using Gemini model');
      llm = new ChatGoogleGenerativeAI({
        model: modelName,
        temperature: 0,
        apiKey: process.env.GOOGLE_AI_API_KEY,
      });
    } else {
      console.log('Using OpenAI model');
      llm = new ChatOpenAI({
        modelName: modelName || 'gpt-4o-mini',
        temperature: 0,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    }

    console.log('\n--- INVOKING LLM ---');
    const result = await llm.invoke([{ role: 'user', content: 'Say "Tracing works!"' }]);
    console.log('Response:', result.content);
    console.log('\n✅ Script reached the end! If tracing is working, you should see this run in LangSmith.');
    
    // Wait for traces to flush
    console.log('Waiting 3 seconds for traces to flush...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.error('❌ Error during LLM test:', error);
  }
}

testTracing();
