---
trigger: always_on
description: Enforce SOLID principles and Hexagonal Architecture (Ports & Adapters).
---

# Architecture for Typescript projects

All code development must strictly adhere to **SOLID principles** and **Hexagonal Architecture**.

## 1. Hexagonal Architecture Layers

Organize code into three distinct layers:

### Domain Layer (`src/Domain`)

- **Entities**: Core business objects (e.g., `Note`, `User`). Pure objects, validation logic only.
- **Ports**: Interfaces defining interactions with external world (e.g., `NoteRepositoryPort`, `UIServicePort`).
- **Rules**:
  - MUST NOT depend on outer layers (`Application`, `Infrastructure`).
  - MUST NOT vary based on external frameworks (e.g., no Obsidian logic).

### Application Layer (`src/Application`)

- **Use Cases**: Encapsulate specific business rules/user goals (e.g., `ApplyTemplateUseCase`).
- **Services**: Reusable application logic (orchestration).
- **Rules**:
  - Depends ONLY on the **Domain Layer**.
  - Orchestrates Domain Objects and Ports.
  - MUST NOT depend on `Infrastructure` directly.

### Infrastructure Layer (`src/Infrastructure`)

- **Adapters**: Concrete implementations of Domain Ports (e.g., `ObsidianNoteRepositoryAdapter`).
- **Framework Code**: UI Components, Commands, API handlers.
- **Rules**:
  - Depends on **Domain** (to implement Ports) and **Application** (to execute Use Cases).
  - Can depend on external libraries (e.g., Obsidian API).

## 2. Dependency Rule (DIP)

Dependencies must point **inwards**.

- `Infrastructure` -> `Application` -> `Domain`
- `Infrastructure` -> `Domain`

**NEVER** import `Infrastructure` code into `Domain` or `Application`.

## 3. SOLID Principles Checklist

- **SRP (Single Responsibility)**: Classes/functions have one reason to change. Use Cases do one thing.
- **OCP (Open/Closed)**: Extend functionality by adding new code (e.g., new Adapters), not modifying existing logic.
- **LSP (Liskov Substitution)**: Adapters must be interchangeable implementations of Ports.
- **ISP (Interface Segregation)**: Ports should be small and specific.
- **DIP (Dependency Inversion)**: High-level modules (Application) should not depend on low-level modules (Infrastructure). Both should depend on abstractions (Domain Ports).

## 4. Implementation Guidelines

- **Commands as Controllers**: Obsidian Commands should be thin controllers. Instantiate Adapters and Use Cases, then call `useCase.execute()`. No business logic in Commands.
- **Dependency Injection**: Inject dependencies (Ports) into Use Cases via constructor.
