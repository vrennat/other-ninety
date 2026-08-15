---
name: typecheck
description: Run TypeScript type checking on the codebase. Use after making code changes to verify type safety, before committing, or when debugging type errors.
---

# TypeScript Type Checking

Run type checking to verify code correctness.

## Commands

```bash
# One-time check (npm)
npm run check

# One-time check (bun)
bun run check

# Watch mode (continuous)
npm run check:watch
# or
bun run check:watch
```

## What It Checks

- TypeScript type errors
- Component prop types
- Import/export correctness
- Type inference issues
- Strict null checks

## When to Run

- **After code changes** - Verify new code is type-safe
- **Before committing** - Catch errors before they're pushed
- **When debugging** - Identify type mismatches
- **After refactoring** - Ensure changes didn't break types

## Example Prompts

- "Run typecheck on the codebase"
- "Check for type errors"
- "Verify my changes are type-safe"
- "Run type checking in watch mode"

## Common Type Errors

### Missing Properties
```typescript
// Error: Property 'foo' does not exist
interface User { name: string }
const user: User = { name: "Alice", foo: 1 } // Error
```

### Null/Undefined
```typescript
// Error: Object is possibly 'undefined'
const user = users.find(u => u.id === id);
user.name; // Error - could be undefined
user?.name; // OK
```

### Wrong Types
```typescript
// Error: Type 'string' is not assignable to type 'number'
const count: number = "42"; // Error
```

## Tips

- Fix errors from source type files first
- Use `as const` for literal types
- Prefer `unknown` over `any`
- Run before every commit
