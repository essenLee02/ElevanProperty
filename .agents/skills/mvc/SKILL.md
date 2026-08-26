---
name: mvc
description: This skill should be used when the user asks about "mvc pattern", "model view controller", "when to use mvc", "separate concerns", "ui architecture", or mentions needing to separate data, presentation, and user input handling.
version: 1.0.0
---

# MVC (Model-View-Controller) Pattern

## What Is It
MVC separates an application into three components: Model (data and business logic), View (presentation/UI), and Controller (handles user input and coordinates Model and View). This separation enables independent development, testing, and maintenance.

## When to Use
- **Web applications** - Traditional server-rendered apps
- **Desktop applications** - GUI applications with clear separation
- **Mobile apps** - iOS (UIKit) and Android development
- **Frameworks** - Ruby on Rails, Django, ASP.NET MVC
- **Testable UI** - Need to test logic without UI

## When NOT to Use
- **Simple apps** - Overkill for basic applications
- **Real-time updates** - Consider MVP or MVVM instead
- **Modern SPAs** - React/Vue/Angular use component-based approach
- **Small teams** - May add unnecessary complexity

## How to Implement

### Implementation Steps
1. Create Model classes for data and business logic
2. Create View classes/templates for presentation
3. Create Controller to handle input and coordinate
4. Model notifies View of changes (via Observer)
5. Controller updates Model based on user input

### TypeScript Implementation

```typescript
// Model
class UserModel {
  private users: User[] = [];
  private observers: (() => void)[] = [];

  addUser(user: User): void {
    this.users.push(user);
    this.notify();
  }

  subscribe(observer: () => void): void {
    this.observers.push(observer);
  }

  private notify(): void {
    this.observers.forEach(o => o());
  }
}

// View
class UserView {
  render(users: User[]): string {
    return users.map(u => `<li>${u.name}</li>`).join('');
  }
}

// Controller
class UserController {
  constructor(private model: UserModel, private view: UserView) {}

  handleAddUser(name: string): void {
    this.model.addUser({ id: Date.now(), name });
    this.view.render(this.model.getUsers());
  }
}
```

## Code Examples
See `examples/` directory for runnable TypeScript implementations:
- `examples/mvc.ts` - Basic implementation with user management
- `examples/mvc-advanced.ts` - Real-world example with todo app

## Related Patterns
- **Observer** - Model notifies View of changes
- **Strategy** - View can use different rendering strategies
- **Composite** - Views often form composite structures
