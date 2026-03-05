# Agent Rules: Hexagonal Architecture & Best Practices

This document defines the coding standards, architectural patterns, and best practices for the `elo-server` project located in `apps/elo-server`.

## Scope

- **Language**: **Python ONLY**.
- **Directory**: `apps/elo-server` **ONLY**.
- **Applicability**: All AI agents and human developers working within this scope must adhere to these guidelines.

This ensures code quality, maintainability, and scalability within the server application.

## 1. Hexagonal Architecture (Ports and Adapters)

The application follows the Hexagonal Architecture pattern to separate core business logic from external concerns.

### 1.1 Layers

- **Domain (`src/domain`)**:
  - **Responsibility**: Contains the core business logic, entities, value objects, and domain exceptions.
  - **Dependencies**: **MUST NOT** depend on any other layer (Application, Infrastructure) or external frameworks. It should be pure Python code.
  - **Components**: Entities, Value Objects, Domain Services, Repository Interfaces (Ports).

- **Application (`src/application`)**:
  - **Responsibility**: Orchestrates domain objects to fulfill specific use cases or user stories.
  - **Dependencies**: Depends ONLY on the **Domain** layer.
  - **Components**: Use Cases (Interactors), Application Services, DTOs (Data Transfer Objects).

- **Infrastructure (`src/infrastructure`)**:
  - **Responsibility**: Provides implementations for interfaces defined in the Domain/Application layers (Adapters) and interacts with external systems (DB, APIs, UI).
  - **Dependencies**: Depends on **Domain** and **Application** layers.
  - **Components**: Repositories (Implementation), API Controllers (FastAPI routers), External Service Clients, Configuration, Logging.

### 1.2 Dependency Rule

Dependencies must point **inwards**.
`Infrastructure -> Application -> Domain`
The Domain layer is the center of the hexagon and knows nothing about the outer worlds.

## 2. SOLID Principles

- **S - Single Responsibility Principle (SRP)**: A class or function should have only one reason to change. Separate concerns distinctively.
- **O - Open/Closed Principle (OCP)**: Software entities should be open for extension but closed for modification. Use polymorphism and abstraction.
- **L - Liskov Substitution Principle (LSP)**: Subtypes must be substitutable for their base types without altering the correctness of the program.
- **I - Interface Segregation Principle (ISP)**: Clients should not be forced to depend on interfaces they do not use. Split large interfaces into smaller, specific ones.
- **D - Dependency Inversion Principle (DIP)**: Depend on abstractions, not concretions.
  - High-level modules (Domain/Application) should not depend on low-level modules (Infrastructure). Both should depend on abstractions (Ports).

## 3. Python Best Practices

### 3.1 Code Style

- Follow **PEP 8** guidelines.
- Use `black` for code formatting.
- Use `isort` for import sorting.

### 3.2 Type Hinting

- **MANDATORY**: Use Python type hints (`typing` module) for all function signatures (arguments and return types) and class attributes.
- Use `mypy` compatible types.

### 3.3 Documentation

- Use **Google-style** docstrings for all modules, classes, and functions.
- Document usage, arguments, return values, and raised exceptions.

```python
def calculate_elo(current_rating: int, opponent_rating: int, score: float) -> int:
    """Calculates the new Elo rating.

    Args:
        current_rating: The current rating of the player.
        opponent_rating: The rating of the opponent.
        score: The match result (1.0 for win, 0.5 for draw, 0.0 for loss).

    Returns:
        The new calculated Elo rating.
    """
    ...
```

### 3.4 Error Handling

- Use **Custom Exceptions** in the Domain layer to represent domain-specific errors (e.g., `InsufficientFundsError`, `UserNotFoundError`).
- Catch specific exceptions, never bare `except:`.

### 3.5 Testing (Pragmatic Approach)

- **Tooling**: Use `pytest` as the standard runner.
- **Naming Convention**: All test files **MUST** end with `_test.py` (e.g., `logic_test.py`).
- **Unit Tests**: Mandatory for **Domain** and **Application** layers.
  - Focus on complex business logic and edge cases.
  - Mock external ports, but keep mocks simple.
- **Integration Tests**: Mandatory for **Infrastructure** adapters.
  - Verify interaction with external systems (or emulators like `mongomock` or `sqlite`).
- **NO Over-engineering**:
  - **Avoid excessive mocking**: If a dependency is simple, fast, and deterministic (e.g., a helper function or value object), use the real thing.
  - **Don't test trivial code**: Skip getters, setters, or simple pass-through lines.
  - **Focus on ROI**: Test critical paths and edge cases that are likely to break or change.
  - **Refactor-friendly**: Tests should verify _behavior_, not internal implementation details.

### 3.6 Coverage Rules

Matches `libs/core-ts` standards:

- **Global Thresholds**:
  - **Statements**: 80%
  - **Branches**: 80%
  - **Functions**: 80%
  - **Lines**: 80%
- **Specific Targets**:
  - `src/application`
  - `src/infrastructure/adapters`

## 4. Folder Structure Convention

```
src/
├── domain/             # Enterprise business rules
│   ├── entities/       # Business objects
│   ├── ports/          # Interfaces (Repositories, Services)
│   └── exceptions.py   # Domain exceptions
├── application/        # Application business rules
│   ├── use_cases/      # Application specific business rules
│   └── dtos/           # Data Transfer Objects
├── infrastructure/     # Frameworks & Drivers
│   ├── adapters/       # Implementations of ports
│   ├── config/         # Configuration settings
│   └── web/            # Web framework (FastAPI)
└── main.py             # Entry point
```

## 5. Agent Workflow Rules

- **Plan First**: Always create/update `implementation_plan.md` before writing code for complex tasks.
- **Atomic Changes**: Keep PRs/changes focused on a single task or fix.
- **Verification**: Always verify changes with tests or reproduction scripts.
