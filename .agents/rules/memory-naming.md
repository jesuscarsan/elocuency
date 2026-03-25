---
trigger: always_on
description: Naming convention for the project's data storage.
---

# Memory Naming Convention

This project uses the term **Memory** to refer to the collection of markdown notes (previously called "Vault" or "Obsidian folder").

## ⛔️ Forbidden Terms

- Do not use **Vault** (except when referring to the Obsidian API `app.vault`).
- Do not use **Obsidian folder** when referring to the notes storage.

## ✅ Mandatory Terms

- Use **Memory** for the domain entity and classes.
- Use **memory** or **memoryPath** for variables and properties.

## Examples

- `SyncMemoryUseCase` instead of `SyncVaultUseCase`.
- `markdownMemories` in configuration instead of `memoryPaths`.
- `MemoryRepository` instead of `VaultRepository`.
