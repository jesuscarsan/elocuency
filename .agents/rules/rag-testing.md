---
trigger: always_on
description: RAG & Memory Testing strategy including the local test environment.
---

# RAG & Memory Testing

This project includes a dedicated test environment to verify RAG indexing, noise reduction, and memory synchronization without affecting production data.

## 1. Test Memory Environment
- **Path**: `apps/elo-server/assets/memory-test/`
- **Purpose**: Local folder containing deterministic markdown notes (`Noise-*.md`) for agile testing.
- **Notes**: Includes specialized notes for testing links, images, tasks, callouts, and frontmatter cleaning.

## 2. Execution Flags
- **CLI Flag**: Use `--test` in CLI scripts (like `sync-memory.ts`) to prioritize the local test memory path.
- **Env Var**: `TEST_MODE=true` in `.env` makes the test memory the default for all background workers.
- **Recommendation**: Always use `--initialize` (or `-i`) when switching to test mode to ensure a clean slate in the vector database.

## 3. Data Quality Standards
All RAG indexing MUST use the `MarkdownCleaner` service to prevent Obsidian-specific syntax from leaking into the LLM context.
- Stripping of Obsidian and standard links.
- Removal of image embeds.
- Cleaning of task markers.
- Filtering of empty frontmatter fields.
