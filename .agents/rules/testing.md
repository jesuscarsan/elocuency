---
trigger: always_on
description: Testing strategy and patterns.
---

# Testing Strategy

Prioritize **ROBUSTNESS** over **SPEED**.

## 1. Priorities
- **Domain (`src/Domain`)**: **High**. Verify business rules. 80%+ coverage. No mocks.
- **Application (`src/Application`)**: **Medium**. Verify Use Cases. 70%+ coverage. Mock Ports ONLY.
- **Infrastructure (`src/Infrastructure`)**: **Low**. Verify Adapter contracts. 40%+ coverage.

## 2. Core Rules
- ✅ **Test Behavior**: Public API, not internals.
- ✅ **Test Logic**: Utilities and orchestration. Skip simple wrappers/APIs.
- ⛔️ **No Infrastructure Mocks**: Don't mock concrete adapters in Application tests.

## 3. Pattern: Given-When-Then (GWT)
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
