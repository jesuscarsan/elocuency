# Testing Strategy & Guidelines

This project prioritizes **ROBUSTNESS** over **SPEED**, following Hexagonal Architecture principles. 
For the full strategy, refer to the shared documentation: [libs/core-ts/docs/testing-strategy.md](file:///Users/joshua/my-docs/code/elocuency-v3/libs/core-ts/docs/testing-strategy.md).

## Core Principles

1.  **Test Business Logic, Not Infrastructure**: Focus on algorithms and orchestration, skip simple wrappers or external APIs.
2.  **Decoupling**: Tests in one layer must NOT break due to changes in another.
3.  **Refactor-Proof**: Test **observable behavior** (Public API), NOT internal implementation details.

### ✅ DO TEST
- Domain layer utilities with complex algorithms.
- Application services with business rules and orchestration logic.
- Complex data transformations and validations.
- Edge cases in string manipulation and path building.

### ❌ DON'T TEST
- Simple interfaces and type definitions.
- External API adapters (Google Maps, Gemini, Spotify, YouTube).
- Obsidian API wrappers.
- Trivial getters/setters.

## Layer-Specific Strategies & Priorities

### 1. Domain Layer (`src/Domain`) - **PRIORITY 1**
- **Goal**: Verify pure business rules and invariants.
- **Coverage Target**: **80%+**.
- **Rules**:
    - ✅ Instantiate real Entities and Value Objects.
    - ⛔️ **NEVER Mock** Domain Entities.
- **Location**: Co-located `src/Domain/.../*.test.ts`.

### 2. Application Layer (`src/Application`) - **PRIORITY 2**
- **Goal**: Verify Use Case orchestration and user flows.
- **Coverage Target**: **70%+**.
- **Rules**:
    - ✅ **Mock ONLY Ports** (Interfaces) using factories in `src/__test-utils__/mockFactories.ts`.
    - ⛔️ **NEVER Mock** concrete Infrastructure implementations.
- **Location**: Co-located `src/Application/.../*.test.ts`.

### 3. Infrastructure Layer (`src/Infrastructure`) - **PRIORITY 3**
- **Goal**: Ensure adapters work with the real world or faithful simulations.
- **Coverage Target**: **40%+**.
- **Rules**:
    - ✅ **Verify Contracts**: Adapters must fulfill the Port's contract.
    - ✅ Use high-fidelity mocks for external libraries if real APIs are not feasible.
- **Location**: Co-located `src/Infrastructure/.../*.test.ts`.

## Maintainability Patterns

### Object Mothers / Factories
- Use factories to create valid domain objects for tests.
- Reference: `src/__test-utils__/mockFactories.ts`.

### Given-When-Then (GWT)
- **Structure**: ALWAYS use the GWT pattern for test bodies.
    ```typescript
    it('should ...', async () => {
        // GIVEN
        const item = ItemFactory.create();
        // WHEN
        const result = await service.process(item);
        // THEN
        expect(result).toBe(true);
    });
    ```

## Global Coverage Goal
Minimum global threshold: **30-50%** (gradual improvement).
Refer to `jest.config.js` for current enforcement.
