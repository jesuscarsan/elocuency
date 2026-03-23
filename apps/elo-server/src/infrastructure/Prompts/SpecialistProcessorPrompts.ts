export const ASK_OBSIDIAN_PROMPT = `Use the following context snippets from my Obsidian vault to answer the user's question. 
If the context doesn't contain the answer, answer based on your general knowledge but clarify that the answer was not found in the vault.
IMPORTANT: You must respond in the exact same language that the user used in their question.
        
Context from Obsidian:
{contextStr}

User Question: {original_input}`;

export const MODIFY_OBSIDIAN_PROMPT = `[OBSIDIAN EDIT]: This is a placeholder for executing vault modification based on: {original_input}`;

export const WEB_SEARCH_PROMPT = `[WEB SEARCH]: This is a placeholder for searching the web for: {context}`;

export const ACTION_SCRIPT_PROMPT = `[ACTION SCRIPT]: This is a placeholder triggering webhook for: {context}`;
