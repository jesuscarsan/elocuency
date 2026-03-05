# Project Structure and Architecture Standards

In general, we follow SOLID principles, Hexagonal Architecture, and Domain Driven Design.

This document defines the directory structure and architecture rules that **MUST** be followed to maintain code quality, scalability, and maintainability without overengineering.

## Fundamental Principle

Dependency flows **inwards**. Domain code knows nothing about Application or Infrastructure. Application knows no details of Infrastructure.

## Layers

### 1. Domain (`src/Domain`)

_The core of the business. Pure TypeScript code. No external dependencies._

- **Content**: Entities, Value Objects, Business Rules, and **Ports** (Interfaces).
- **Rules**:
  - ⛔️ Do NOT import anything from `Application` or `Infrastructure`.
  - ⛔️ Do NOT use external libraries or frameworks (e.g., Obsidian API).
  - ✅ Define interfaces (`Ports`) for any interaction with the outside world (Database, APIs, UI).

**Structure**:

- `src/Domain/Models/`: Pure entities and data types.
- `src/Domain/Ports/`: Interfaces that must be implemented by the Infrastructure layer (e.g., `LlmPort`, `AudioPlayerPort`).

---

### 2. Application (`src/Application`)

_Orchestration and Use Cases. Coordinates data flow between UI/Infrastructure and Domain._

- **Content**: Application Services, Use Cases.
- **Rules**:
  - ✅ Can import from `Domain`.
  - ⛔️ Do NOT import concrete implementations from `Infrastructure`.
  - ✅ Use `Ports` defined in Domain to interact with external services.

**Structure**:

- `src/Application/UseCases/`: Specific logic for a user action (e.g., `StartLiveSession`, `ProcessUserMessage`).
- `src/Application/Services/`: Services that group logic from multiple use cases if necessary.

---

### 3. Infrastructure (`src/Infrastructure`)

_The real world. Concrete implementations, Frameworks, and Tools._

- **Content**: UI (Obsidian Views), API Adapters (Gemini, OpenAI), File Access, Configuration.
- **Rules**:
  - ✅ Can import from `Domain` and `Application`.
  - ✅ This is the **only** place where using the Obsidian API (`obsidian`) is allowed.
  - ✅ Dependencies are injected here (Dependency Injection).
  - ✅ **Colocation**: Auxiliary files (`DTOs`, `Mappers`, `Types`) specific to an adapter must go **inside** the adapter's folder (e.g., `src/Infrastructure/Adapters/Google/api`), NOT in the `Infrastructure` root.

**Structure**:

- `src/Infrastructure/Adapters/`: Implementation of Ports (e.g., `GoogleGeminiLiveAdapter` implements `LlmPort`).
  - `[Provider]/`: Folder to group adapters by provider (e.g., `Google`, `OpenAI`).
    - `api/`: DTOs and Mappers specific to this provider.
- `src/Infrastructure/Obsidian/`: Code coupled to Obsidian.
  - `Views/`: Visual components and React Views.
  - `Commands/`: Plugin commands.
  - `MarkdownPostProcessors/`: Markdown renderers.

### Obsidian Code Centralization (`libs/obsidian-plugin`)

To maintain consistency and avoid duplication, any Obsidian-specific logic, utility, or adapter that can be reused across multiple plugins **MUST** be centralized in `libs/obsidian-plugin`.

- **Reusable Adapters**: Generic implementations of `EditorPort`, `FileSystemPort`, etc.
- **UI Components**: Modals, views, or styles that are common to the platform.
- **Utilities**: Helpers for markdown manipulation, view mode switching, etc.

## Naming Conventions

1.  **Folders in `src/`**:
    - Must use **PascalCase** (CamelCase with initial capital) by default (e.g., `Domain`, `UseCases`, `GoogleContacts`).
    - **Exception**: If there is a strong standard dictating otherwise (e.g., `api`, `__tests__`, `dist`, `assets`), lowercase is allowed. But for source code folders (Feature, Component, Module), use PascalCase.
    - **Python Projects**: For Python projects (e.g., `elo-server`), follow **PEP 8** standards: use **snake_case** for directories and files (e.g., `domain`, `use_cases`, `ai_port.py`).

## Language Standards

1.  **Documentation**:
    - All documentation (READMEs, comments, architecture docs) **MUST** be written in **English**.

## Quick Location Guide

| File Type                          | Location                               | Example                      |
| :--------------------------------- | :------------------------------------- | :--------------------------- |
| **Interface** for external service | `src/Domain/Ports`                     | `LlmPort.ts`                 |
| **Pure Business Logic**            | `src/Domain/Models`                    | `Session.ts`                 |
| **User Action** (Logic)            | `src/Application/UseCases`             | `StartSessionUseCase.ts`     |
| **API Call** (Gemini, etc.)        | `src/Infrastructure/Adapters`          | `GoogleGeminiLiveAdapter.ts` |
| **View** / UI (React, HTML)        | `src/Infrastructure/Obsidian/Views`    | `LiveSessionView.ts`         |
| **Obsidian Command**               | `src/Infrastructure/Obsidian/Commands` | `OpenSessionCommand.ts`      |

## New Feature Workflow

1.  **Define the Port (Domain)**: What do I need from the outside? (e.g., `InventoryRepository`).
2.  **Implement the Use Case (Application)**: What does the user do? (e.g., `AddItemToInventory`).
3.  **Implement the Adapter (Infrastructure)**: How is it actually saved? (e.g., `ObsidianFileRepository`).
4.  **Connect in View/Command (Infrastructure)**: Inject the adapter into the use case and execute it.

## Testing

- **Principle**: Co-location. Tests live next to the code they test.
- **Naming Convention**: `[FileName].test.ts`.
- **Location**:
  - If you test `src/Domain/MyEntity.ts`, the test goes in `src/Domain/MyEntity.test.ts`.
  - If you test `src/Application/UseCases/MyUseCase.ts`, the test goes in `src/Application/UseCases/MyUseCase.test.ts`.
- **Mocks**:
  - Global mocks (e.g., Obsidian) go in `src/__mocks__`.
  - Local mocks can go in a `__tests__` or `__mocks__` folder next to the code if very specific, but we prefer inline mocks or shared helpers in `src/Infrastructure/Testing`.

## Import Standards and Barrel Files

To keep the project clean and facilitate refactoring:

1.  **Barrel Files (`index.ts`)**:
    - **ONLY** allowed in the root directories of main layers:
      - `src/Domain/index.ts`
      - `src/Application/index.ts`
      - `src/Infrastructure/index.ts`
    - ⛔️ **FORBIDDEN** to create `index.ts` files in subdirectories (e.g., `src/Domain/Models/index.ts`). This avoids circular dependencies and tree-shaking issues.

2.  **Aliased Imports (`@`)**:
    - ✅ Always use the `@` alias for absolute imports instead of long relative paths.
    - Example: `import { ... } from '@/Domain/Models/...'` instead of `import { ... } from '../../Domain/Models/...'`.

To trace messages, use the utility "showMessage" instead of "new Notice".
