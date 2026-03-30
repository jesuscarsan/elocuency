---
description: Ensure all AI Prompts are strictly isolated from application and graph logic.
---

# AI Prompt Isolation

To ensure that the codebase remains clean, professional, and easy to translate, all AI generation prompts must be **isolated** from the main TypeScript logic and LangGraph nodes.

## Core Rules

1. ⛔️ **Zero Hardcoded Prompts**: You MUST NEVER write raw string templates for LLM instructions inside Use Cases, Adapters, or LangGraph files (e.g. `MasterConversationGraph.ts`, `NoteCreatorGraph.ts`).
2. ✅ **Dedicated Files**: All prompts must live in `src/infrastructure/Prompts/`. 
3. ✅ **Structured Output Schemas**: While Zod schemas defining output structures *may* remain inside the file where the extraction happens (to maintain type proximity), the primary `systemPrompt` or instructions containing the persona and guidelines MUST be imported.
4. ✅ **Constants Naming**: Export prompts as uppercase constants ending in `_PROMPT` (e.g. `EXTRACT_ENTITIES_PROMPT`).

## Validation
Any time you modify a LangGraph file or an AI Use Case, you **must** verify that no system prompts or instructional strings are hardcoded inline.
