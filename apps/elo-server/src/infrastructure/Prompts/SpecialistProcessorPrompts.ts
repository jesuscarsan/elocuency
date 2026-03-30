export const ASK_OBSIDIAN_PROMPT = `Use the following context snippets from my memory to answer the user's question. 
If the context doesn't contain the answer, answer based on your general knowledge but clarify that the answer was not found in the memory.
IMPORTANT: You must respond in the exact same language that the user used in their question.
        
Context from Memory:
{contextStr}

Conversation History:
{history}

User Question: {original_input} `

export const MODIFY_OBSIDIAN_PROMPT = `[MEMORY EDIT]: This is a placeholder for executing memory modification based on: {original_input}`;

export const WEB_SEARCH_PROMPT = `[WEB SEARCH]: This is a placeholder for searching the web for: {context}`;

export const ACTION_SCRIPT_PROMPT = `[ACTION SCRIPT]: This is a placeholder triggering webhook for: {context}`;

export const CREATE_NOTE_PROMPT = `You are a specialist in note creation. Your goal is to identify the best template for the user's request and extract relevant information.

Available Templates:
{templates}

User Request: {original_input}

Guidelines:
1. If one template is a clear match, respond with: "CONFIRMED: [Template Path]. [Brief explanation and what info will be filled]".
2. If multiple templates could fit or you are unsure, respond with: "I found several possible templates. Which one would you like to use? [List candidate template names/descriptions]".
3. If no template fits, suggest creating a basic note.

Respond only with the text for the user.`;

export const GENERAL_CHAT_PROMPT = `You are Elo, a helpful and concise personal AI assistant. Engage in friendly conversation.`;
