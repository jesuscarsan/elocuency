# Testing Strategy

This document defines the testing approach for the elo-obsidian-core-plugin following Hexagonal Architecture principles.

## Core Principles

### 1. Test Business Logic, Not Infrastructure

**✅ DO TEST:**
- Domain layer utilities with complex algorithms
- Application services with business rules and orchestration logic
- Complex data transformations and validations
- State management and workflow logic

**❌ DON'T TEST:**
- Simple interfaces and type definitions
- External API adapters (Google Maps, Gemini, Spotify, YouTube)
- Obsidian API wrappers
- Trivial getters/setters
- Simple constructors without logic

### 2. Prioritize by Layer

**Priority Order:**
1. **Domain Layer** - Pure business logic (Target: 80%+ coverage)
2. **Application Layer** - Use cases and services (Target: 70%+ coverage)
3. **Infrastructure Layer** - Commands with business logic (Target: 40%+ coverage)

### 3. Focus on High-Value Tests

**High ROI (Return on Investment):**
- Complex algorithms (e.g., Levenshtein distance, similarity calculations)
- Business rules with multiple branches (e.g., quiz filtering, scoring)
- Data validation and normalization
- Edge cases in string manipulation and path building

**Low ROI (Avoid):**
- Mocking external APIs extensively
- Testing framework-specific code (Obsidian APIs)
- Simple pass-through methods
- Code already covered by TypeScript type checking

## Testing Guidelines by Layer

### Domain Layer

**What to test:**
```typescript
// ✅ Complex utilities
Domain/Utils/Strings.ts -> levenshtein(), similarity()

// ❌ Simple models
Domain/Models/QuizItem.ts -> Interface only, no tests needed
```

**Example structure:**
```typescript
describe('Domain Utils', () => {
  describe('algorithm name', () => {
    it('should handle normal case')
    it('should handle edge case')
    it('should handle error case')
  });
});
```

### Application Layer

**What to test:**
```typescript
// ✅ Services with business logic
Application/Services/QuizService.ts
  - recordBlockScore() -> averaging logic
  - buildQuizQueue() -> filtering rules
  - Quiz filtering by importance level

Application/Services/HeaderDataService.ts
  - findMissingHeaders() -> comparison logic
```

**Test approach:**
- Use mocked ports (dependency injection)
- Focus on orchestration logic, not port implementations
- Test different branch conditions

**Example:**
```typescript
describe('QuizService', () => {
  let service: QuizService;
  let mockNoteManager: jest.Mocked<NoteManagerPort>;
  
  beforeEach(() => {
    mockNoteManager = createMockNoteManager();
    service = new QuizService(mockNoteManager, ...);
  });
  
  describe('buildQuizQueue', () => {
    it('should filter H1 and H2 when no filter selected');
    it('should filter by importance level when specified');
    it('should skip headers with children when configured');
  });
});
```

### Infrastructure Layer

**What to test:**
```typescript
// ✅ Commands with validation logic
Commands/*/Command.ts -> Input validation, edge cases

// ✅ Utils with complex logic
Obsidian/Utils/LocationPathBuilder.ts -> Path construction rules

// ❌ Simple adapters
Adapters/GoogleGeminiAdapter.ts -> External API, skip
Adapters/ObsidianNoteManager.ts -> Framework wrapper, skip
```

**Command testing focus:**
- Input validation
- Error handling
- Edge cases (empty files, missing data)

## Test File Organization

### Naming Convention
```
src/
  Domain/
    Utils/
      Strings.ts
      Strings.test.ts  ← Next to implementation
  Application/
    Services/
      QuizService.ts
      QuizService.test.ts  ← Next to implementation
```

### Test Utilities
```
src/__test-utils__/
  mockFactories.ts  ← Factory functions for mocks
  testData.ts       ← Reusable test data
```

Example factory:
```typescript
// src/__test-utils__/mockFactories.ts
export function createMockNoteManager(): jest.Mocked<NoteManagerPort> {
  return {
    getActiveNote: jest.fn(),
    getActiveNoteContent: jest.fn(),
    getNoteMetadata: jest.fn(),
  };
}
```

## Coverage Thresholds

Current configuration in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 30,
    functions: 30,
    lines: 30,
    statements: 30,
  }
}
```

**Recommended gradual improvements:**

```javascript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
  './src/Domain/': {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
  './src/Application/': {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  }
}
```

## Common Testing Patterns

### 1. Testing Services with Dependencies

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDep1: jest.Mocked<Port1>;
  let mockDep2: jest.Mocked<Port2>;

  beforeEach(() => {
    mockDep1 = createMockPort1();
    mockDep2 = createMockPort2();
    service = new ServiceName(mockDep1, mockDep2);
  });

  it('should...', async () => {
    // Arrange
    mockDep1.method.mockResolvedValue(expectedValue);
    
    // Act
    const result = await service.methodUnderTest(input);
    
    // Assert
    expect(result).toBe(expected);
    expect(mockDep1.method).toHaveBeenCalledWith(expectedArgs);
  });
});
```

### 2. Testing Algorithms

```typescript
describe('algorithmName', () => {
  it('should handle identical inputs', () => {
    expect(algorithm('same', 'same')).toBe(expectedValue);
  });
  
  it('should handle edge case: empty strings', () => {
    expect(algorithm('', '')).toBe(expectedValue);
  });
  
  it('should calculate correctly for known examples', () => {
    expect(algorithm('kitten', 'sitting')).toBe(3);
  });
});
```

### 3. Testing State Management

```typescript
describe('stateful operation', () => {
  it('should maintain state correctly', () => {
    service.setState(initialState);
    service.performOperation();
    expect(service.getState()).toEqual(expectedState);
  });
});
```

## When to Skip Tests

### Skip if:
1. **Simple TypeScript interface** - Type system provides safety
2. **External API adapter** - Would require extensive mocking
3. **Framework-specific code** - Obsidian API wrappers
4. **Pass-through methods** - No logic to test
5. **Auto-generated code** - E.g., simple DTOs

### Example - NO TESTS NEEDED:

```typescript
// ❌ Don't test - Simple interface
export interface QuizItem {
  heading: string;
  blockId: string;
  text: string;
}

// ❌ Don't test - Simple wrapper
class ObsidianAdapter {
  constructor(private app: App) {}
  
  getActiveFile() {
    return this.app.workspace.getActiveFile();
  }
}

// ❌ Don't test - External API call
class GeminiAdapter {
  async callAPI(prompt: string) {
    return await fetch(GEMINI_API_URL, {...});
  }
}
```

## Priority Test Implementation Order

Based on current coverage analysis:

### High Priority (Implement First)
1. **`Domain/Utils/Strings.test.ts`** (~2h)
   - Complex algorithms (levenshtein, similarity)
   - Pure functions, easy to test
   - High business value

2. **`Application/Services/QuizService.test.ts`** (~4h)
   - Critical business logic (scoring, filtering)
   - Multiple branches and edge cases
   - Core functionality

3. **`Application/Services/HeaderDataService.test.ts`** (~1h)
   - Data comparison logic
   - Edge cases in normalization

### Medium Priority
4. Improve existing Command tests
   - Add error cases
   - Add edge cases (empty content, etc.)

### Low Priority
5. Integration tests for critical user flows
   - Only if recurring bugs justify the effort

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test file
npm test -- Strings.test.ts

# Run in watch mode
npm test -- --watch

# Update snapshots
npm test -- -u
```

## Continuous Improvement

1. **Review coverage reports** after each feature
2. **Increase thresholds gradually** as coverage improves
3. **Refactor tests** when they become brittle
4. **Remove obsolete tests** when features are removed
5. **Keep tests fast** - Mock slow dependencies

## Anti-Patterns to Avoid

❌ **Over-mocking** - Mocking everything makes tests brittle  
❌ **Testing implementation details** - Test behavior, not internals  
❌ **Slow tests** - Keep unit tests under 100ms each  
❌ **Flaky tests** - Use deterministic data, avoid random values  
❌ **Large test files** - Split into multiple describe blocks  
❌ **Duplicate logic** - Use test helpers and factories

## Success Metrics

- **Domain**: 80%+ coverage
- **Application**: 70%+ coverage  
- **Infrastructure/Commands**: 40%+ coverage
- **Overall**: 50%+ coverage
- **All tests run in < 30s**
- **Zero flaky tests**

---

**Remember**: Tests are code too. Keep them clean, maintainable, and focused on business value.
