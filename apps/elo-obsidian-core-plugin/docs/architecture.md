# Architecture

This plugin follows the **Hexagonal Architecture (Ports & Adapters)** pattern to ensure separation of concerns and testability.

## Layers

### 1. Domain (`src/Domain`)
Contains the core business logic, models, and interfaces (Ports). usage of external frameworks (like Obsidian API) is strictly forbidden here.
- **Models**: `QuizItem`, etc.
- **Ports**: `NotificationPort`, etc.

### 2. Application (`src/Application`)
Contains the application logic and use cases. It orchestrates the flow of data between the Domain and Infrastructure layers.
- **Services**: `QuizService`, `ContextService`, etc.

### 3. Infrastructure (`src/Infrastructure`)
Contains the implementation of the interfaces defined in the Domain layer (Adapters) and specific framework code (Obsidian Views/Commands).
- **Adapters**: `ObsidianNoteManager`, `ObsidianNotificationAdapter`.
- **Obsidian**: Commands, Views, Utils.

## Dependency Rule
Dependencies must always point inwards:
`Infrastructure` -> `Application` -> `Domain`
