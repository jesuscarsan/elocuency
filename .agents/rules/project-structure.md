# Project Structure & Architecture Rules

This project follows **Hexagonal Architecture (Ports & Adapters)** and **Domain-Driven Design (DDD)**.
These rules apply to all applications within the `apps/` directory.

## Core Principles

1.  **Dependency Rule**: Dependencies point **inwards**.
    - `Infrastructure` -> `Application` -> `Domain`
    - `Domain` depends on NOTHING.
2.  **Abstractions**: High-level modules should not depend on low-level modules. Both should depend on abstractions (Ports).

## Layer Definitions

### 1. Domain (`src/Domain`)

- **Content**: Business Logic, Entities, Value Objects, and **Ports** (Interfaces).
- **Strict Rules**:
  - ⛔️ **NEVER** import from `Application` or `Infrastructure`.
  - ⛔️ **NEVER** import external frameworks (e.g., `obsidian` API, React).
  - ✅ **DEFINE** interfaces (Ports) here for any external interaction (database, API, UI).

### 2. Application (`src/Application`)

- **Content**: Use Cases, Application Services.
- **Strict Rules**:
  - ✅ **IMPORT** from `Domain`.
  - ⛔️ **NEVER** import concrete implementations from `Infrastructure`.
  - ✅ **USE** Domain Ports to interact with the outside world.

### 3. Infrastructure (`src/Infrastructure`)

- **Content**: Framework implementations, API Clients, UI, File System access.
- **Structure**:
  - `Adapters/`: Driven adapters (implement Domain Ports). Group by Provider (e.g., `Obsidian/`, `Google/`).
  - `Presentation/`: Driving adapters (User Interface, Entry Points).
- **Strict Rules**:
  - ✅ **IMPORT** from `Domain` and `Application`.
  - ✅ **IMPLEMENT** Domain Ports in `Adapters/`.
  - ✅ **EXCLUSIVE**: This is the ONLY layer allowed to use the `obsidian` API or UI libraries.
  - ✅ **RENAME** Infrastructure Services that implement Ports to `[Provider][PortName]Adapter`.

### Plugin Entry Point (`src/Infrastructure/Presentation/Obsidian/main.ts`)

- **Max ~150 lines**. `main.ts` is a lightweight orchestrator, NOT a God Object.
- **Required pattern**:
  - `DependencyContainer.ts`: creates and stores all dependencies (adapters, services).
  - `CommandRegistry.ts`: registers all commands, receiving dependencies from the container.
  - `main.ts`: loads settings → creates container → registers commands, views, ribbon icons, events.
- ⛔️ **NEVER** instantiate adapters/services directly in `main.ts`.
- ⛔️ **NEVER** define command callbacks inline in `main.ts`.

### Single Responsibility in Services

- Each service/adapter class must have **a single responsibility**.
- ⛔️ **FORBIDDEN** to mix in the same class:
  - Process management (spawn/kill) with HTTP clients.
  - Data access with presentation logic.
  - Orchestration with concrete implementation.
- ✅ If a service grows to **2+ responsibilities**, split immediately.

### Service Location

Decide **where** to place a service based on its dependencies:

| If the service...                        | Then place in...                                 | Example                                              |
| :--------------------------------------- | :----------------------------------------------- | :--------------------------------------------------- |
| Only uses **Ports** (Domain interfaces)  | `Application/Services/`                          | `ImageEnricherService` (uses `ImageSearchPort`)      |
| Uses **Obsidian API** or other framework | `Infrastructure/Presentation/Obsidian/Services/` | `FrontmatterEventService` (uses `app.metadataCache`) |
| Is an **external HTTP/API client**       | `Infrastructure/Adapters/[Provider]/`            | `OpenSubtitlesAdapter` (HTTP calls)                  |

### Helpers and Utils

Where to place utility functions?

| If the function...              | Then place in...                              |
| :------------------------------ | :-------------------------------------------- |
| Is **pure** (no framework deps) | `Domain/Utils/`                               |
| Is **reusable** Obsidian logic  | `@elo/obsidian-plugin` (centralized library)  |
| Is **specific** to one plugin   | `Infrastructure/Presentation/Obsidian/Utils/` |

> [!IMPORTANT]
> Any Obsidian-specific logic, adapter, or UI component that is potentially reusable across multiple plugins **MUST** be moved to `libs/obsidian-plugin`. Avoid duplication at all costs.

⛔️ **FORBIDDEN** to create `Utils/` folders in `Application/`. If you need application helpers, place them next to the UseCase that uses them or create a specific module.

## Workspace Directory (`/workspace`)

- **Purpose**: This directory is **NOT** part of the application code.
- **Role**: It serves as a working folder for the end user and for dynamic data storage (e.g., n8n workflows, local tools, document processing).
- **Rule**: Avoid treating files in this directory as source code. Do not refactor or modify its structure unless explicitly requested for integration purposes. This folder is typically ignored by Git.

## Configuration & Secrets

- **Secrets (`setup/.env`)**: All sensitive information, API keys, and credentials **MUST** be placed in the `setup/.env` file. These values should never be committed to version control or placed in JSON files.
- **General Configuration (`/elo-workspace/elo-config.json`)**: Non-secret configuration, preferences, and workspace settings should be placed in `/elo-workspace/elo-config.json`. This file must not contain any secrets.

## Assets Directory (`apps/elo-server/assets`)

- **Purpose**: Version-controlled resources that are used by the applications.
- **Content**: Base LangChain tools, standard n8n workflows, templates, and static data.
- **Relationship with Workspace**:
  - `apps/elo-server/assets` contains the **Source of Truth** for built-in features.
  - Files from `apps/elo-server/assets` can be copied, symlinked, or loaded by applications into the `/workspace` to be available at runtime.
- **Rule**: If a tool or workflow is meant to be shared with other developers or deployed as part of the system, it MUST live in `apps/elo-server/assets`.

## Naming Conventions

1.  **Folders in `src/`**:
    - **TypeScript**: Must use **PascalCase** (CamelCase with initial capital).
    - **Python**: Follow **PEP 8** standards: use **snake_case** for directories and files.

### Models vs Entities

- **Rule**: Use only `Domain/Models/` for interfaces/types.
- **Entities** are objects with **persistent identity** (id, equals methods, lifecycle).
- If it has no identity → it's a **Model/VO**, place in `Domain/Models/`.
- ⛔️ Don't create `Domain/Entities/` unless you truly need entities with identity.

## Workflow & Location Guide

When adding new features, identify the component type and place it correctly:

| Component Type     | Directory                                           | Naming Pattern                    |
| :----------------- | :-------------------------------------------------- | :-------------------------------- |
| **Interface/Port** | `src/Domain/Ports`                                  | `[Name]Port.ts`                   |
| **Entity/Model**   | `src/Domain/Models`                                 | `[Name].ts`                       |
| **Business Logic** | `src/Application/UseCases`                          | `[Verb][Noun]UseCase.ts`          |
| **API/DB Adapter** | `src/Infrastructure/Adapters/[Provider]`            | `[Provider][Interface]Adapter.ts` |
| **Obsidian UI**    | `src/Infrastructure/Presentation/Obsidian/Views`    | `[Name]View.ts`                   |
| **Obsidian Cmd**   | `src/Infrastructure/Presentation/Obsidian/Commands` | `[Name]Command.ts`                |

## Coding Standards

### Imports

- **Aliases**: ALWAYS use `@/` for absolute imports.
  - ✅ `import { User } from '@/Domain/Models/User'`
  - ⛔️ `import { User } from '../../Domain/Models/User'`
  - ⛔️ `import { X } from 'src/...'` — this is NOT a valid alias, use `@/`.
- **Barrel Files**: `index.ts` are ONLY allowed at the root of `Domain`, `Application`, and `Infrastructure`. They are forbidden in subdirectories.
  - If you need to import a command/service, use direct file imports.
  - ✅ `import { MyCommand } from '@/Infrastructure/Obsidian/Commands/MyCommand/MyCommand'`
  - ⛔️ `import { MyCommand } from '@/Infrastructure/Obsidian/Commands'`

### Pre-commit Checklist

Before finalizing any change, verify:

1.  ✅ All imports use `@/` (not `src/` or long relative paths).
2.  ✅ No `index.ts` files exist in subdirectories.
3.  ✅ No empty residual folders.
4.  ✅ `main.ts` doesn't exceed ~150 lines.
5.  ✅ **I18n Compliance**: No hardcoded user-facing strings in the code. All text must be in `en.ts` and `es.ts`.

### Testing

- **Co-location**: Tests MUST be placed next to the file they test.
- **Naming**: `[Filename].test.ts`.

### Specific Utilities

- **Notifications**: Use the internal utility `showMessage` instead of `new Notice` to ensure consistency.
