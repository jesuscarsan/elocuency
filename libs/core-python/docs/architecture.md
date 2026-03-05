# Python Architectural Standards & Refactoring Guide

This document defines the architectural standards for Python projects within the Elo Workbench. It is designed to be used by both human developers and AI agents to ensure consistency, maintainability, and high-quality code.

## 1. Core Principles: SOLID

We strictly adhere to SOLID principles to ensure the codebase remains flexible and easy to refactor.

- **S - Single Responsibility Principle (SRP)**: A class or module should have one, and only one, reason to change.
- **O - Open/Closed Principle (OCP)**: Software entities should be open for extension but closed for modification. Use inheritance or composition (prefer composition) to add behavior.
- **L - Liskov Substitution Principle (LSP)**: Subtypes must be substitutable for their base types without altering the correctness of the program.
- **I - Interface Segregation Principle (ISP)**: No client should be forced to depend on methods it does not use. Favor many small, specific interfaces over one large, general-purpose one. (In Python, use `Protocol` or `ABC`).
- **D - Dependency Inversion Principle (DIP)**: Depend on abstractions, not concretions. Low-level modules should depend on high-level abstractions.

---

## 2. Hexagonal Architecture (Ports & Adapters)

The project is organized into concentric layers. Dependencies must only point **inwards** towards the Domain.

### Layer Definitions

1.  **Domain Layer** (`src/domain`):
    - Contains the core business logic, entities, value objects, and domain services.
    - **Strict Rule**: No dependencies on external frameworks, databases, or libraries (except standard library or utility types).
2.  **Application Layer** (`src/application`):
    - Contains Use Cases (Interactors) and Ports (Interfaces).
    - **Ports**: Define what the application needs (e.g., `UserRepository`, `PaymentGateway`) using `typing.Protocol`.
    - Coordinate the flow of data to and from the domain.
3.  **Infrastructure Layer** (`src/infrastructure`):
    - Contains Adapters (concrete implementations of Ports).
    - **In-Adapters** (`src/infrastructure/in_adapter`): Request handlers, CLI commands, Event listeners. They drive the application.
    - **Out-Adapters** (`src/infrastructure/out_adapter`): Persistence (DB), External API clients, Email services. They are driven by the application.
    - External concerns: Database (SQLAlchemy, Motor), External APIs (Requests, HTTPX), CLI framework (Typer), Web framework (FastAPI).
    - Adapters "plug into" the Ports defined in the Application layer.
4.  **Entry Points / Composition Root** (`src/main.py`):
    - Where the application is assembled (Dependency Injection).
    - Configures environment variables and initializes the adapters.

---

## 3. Project Skeleton

```text
project_root/
├── src/
│   ├── domain/               # Core business logic
│   │   ├── models/           # Pydantic or Dataclasses
│   │   ├── exceptions.py     # Domain-specific errors
│   │   └── services/         # Pure logic spanning multiple entities
│   ├── application/          # Use cases and abstractions
│   │   ├── use_cases/        # Commands/Actions
│   │   └── ports/            # Interfaces (Protocols)
│   ├── infrastructure/       # Concrete implementations
│   │   ├── in_adapter/       # Entry points (FastAPI routers, CLI, etc.)
│   │   └── out_adapter/      # External integrations
│   ├── api/                  # (Optional) HTTP/Web layer
│   └── main.py               # Dependency Injection & Bootstrapping
├── tests/
│   ├── unit/                 # Domain & Application (fast, no DB)
│   └── integration/          # Infrastructure & Adapters (real DB/API)
├── pyproject.toml            # Poetry / PDM configuration
└── .env.example              # Environment template
```

---

## 4. Senior Developer Rules (Pythonic Best Practices)

- **Type Hinting**: Mandatory use of `typing`. Run `mypy` for static analysis.
- **Dependency Injection**: Do not instantiate adapters inside use cases. Pass them in via the constructor.
- **Protocols over ABCs**: Prefer `typing.Protocol` for structural subtyping ("duck typing" with type safety).
- **Immutability**: Use `@dataclass(frozen=True)` or Pydantic `frozen=True` for Value Objects.
- **Functional over Procedural**: Prefer pure functions for logic transformation.
- **Naming**:
  - `Repository` for data access.
  - `Service` for business logic.
  - `Port` for outgoing interfaces.
  - `Adapter` for implementation.

---

## 5. AI Refactoring Guide

When an AI is asked to refactor a project, it must follow these steps:

1.  **Identify the Domain**: Locate the core entities. If they are mixed with SQL or API logic, extract them into `src/domain`.
2.  **Define Ports**: Look at external dependencies (DB calls, API requests). Create a `Protocol` in `src/application/ports` that describes the required operations.
3.  **Implement Adapters**: Move the original implementation logic into `src/infrastructure/adapters`, ensuring it implements the Port.
4.  **Create Use Case**: Wrap the logic flow in a Use Case class in `src/application/use_cases`.
5.  **Inject Dependencies**: Update the calling code to pass the Adapter instances into the Use Case.
6.  **Verify via Tests**: Ensure domain logic is covered by unit tests that use mocks/fakes for the Ports.
