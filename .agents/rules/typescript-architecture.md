---
trigger: always_on
description: Core architecture and structure rules for TypeScript projects.
---

# TypeScript Architecture & Structure

> [!WARNING]
> **PYTHON OBSOLETE**: Do not modify/fix Python files. System runs on TypeScript. Python is for reference only.

## 1. Hexagonal Architecture (Ports & Adapters)

### Layers
- **Domain (`src/Domain`)**: Pure business logic. Entities, Value Objects, Ports (Interfaces). **No dependencies.**
- **Application (`src/Application`)**: Use Cases, Services. Orchestrates Domain. **Depends ONLY on Domain.**
- **Infrastructure (`src/Infrastructure`)**: Adapters (Obsidian, APIs), UI, CLI. **Depends on Domain & Application.**

### Dependency Rule (DIP)
- Dependencies MUST point **inward**: `Infrastructure -> Application -> Domain`.
- ⛔️ **NEVER** import Infrastructure into Domain or Application.

## 2. SOLID & Implementation

- **SRP**: One responsibility per class. Use Cases do ONE thing.
- **OCP/LSP**: Extend via new Adapters/Ports; keep them interchangeable.
- **DIP**: High-level (Application) depends on abstractions (Domain Ports).
- **DI**: Inject Ports into Use Cases via constructor.
- **Commands**: Thin controllers only. No business logic. Call `useCase.execute()`.

## 3. Storage & Isolation

### AI Prompt Isolation
- ⛔️ **NO hardcoded prompts** in logic.
- **elo-server**: Store in `src/infrastructure/Prompts/`.
- **elo-obsidian-plugin**: Store in `src/I18n/locales/`.

### Config & Secrets
- **Secrets**: `setup/.env` ONLY. Never commit.
- **Config**: `/elo-workspace/elo-config.json` for non-secrets.

## 4. Coding Standards

- **Naming**: PascalCase for folders/files in `src/`.
- **Imports**: ALWAYS use `@/` alias for absolute imports.
- **Barrels**: `index.ts` ONLY at root of `Domain/`, `Application/`, `Infrastructure/`. Forbidden in subfolders.
- **I18n**: No hardcoded UI strings. Use `en.ts` and `es.ts`.

## 5. Runtime & Environment

- **Package Manager**: Use `pnpm` exclusively. ⛔️ No npm/yarn.
- **Docker**: Apps run in containers.
  - `setup-elo-server-1`: Python backend.
  - `elo-cli`: Node utilities.
  - Use `docker exec [container] [command]` for execution.

## 6. Legacy Reference (Python)
- Obsolete. Follow PEP 8 and use type hints only if reading for migration.
