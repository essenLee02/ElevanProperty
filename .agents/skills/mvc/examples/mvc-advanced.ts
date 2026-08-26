/**
 * MVC Pattern - Advanced Implementation
 *
 * Real-world example: Todo application with multiple views.
 * Run with: bun run mvc-advanced.ts
 */

// ============================================
// Types
// ============================================

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  priority: "low" | "medium" | "high";
}

type FilterType = "all" | "active" | "completed";

// ============================================
// Model
// ============================================

class TodoModel {
  private todos: Todo[] = [];
  private observers: Set<() => void> = new Set();
  private filter: FilterType = "all";

  constructor() {
    this.todos = [
      {
        id: "1",
        title: "Learn MVC Pattern",
        completed: false,
        createdAt: new Date(),
        priority: "high",
      },
      {
        id: "2",
        title: "Build Todo App",
        completed: true,
        createdAt: new Date(),
        priority: "medium",
      },
    ];
  }

  getAll(): Todo[] {
    return this.applyFilter([...this.todos]);
  }

  private applyFilter(todos: Todo[]): Todo[] {
    switch (this.filter) {
      case "active":
        return todos.filter((t) => !t.completed);
      case "completed":
        return todos.filter((t) => t.completed);
      default:
        return todos;
    }
  }

  getStats(): { total: number; active: number; completed: number } {
    return {
      total: this.todos.length,
      active: this.todos.filter((t) => !t.completed).length,
      completed: this.todos.filter((t) => t.completed).length,
    };
  }

  add(title: string, priority: Todo["priority"] = "medium"): Todo {
    const todo: Todo = {
      id: Date.now().toString(),
      title,
      completed: false,
      createdAt: new Date(),
      priority,
    };
    this.todos.unshift(todo);
    this.notify();
    return todo;
  }

  toggle(id: string): Todo | undefined {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      this.notify();
    }
    return todo;
  }

  update(id: string, updates: Partial<Pick<Todo, "title" | "priority">>): Todo | undefined {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      Object.assign(todo, updates);
      this.notify();
    }
    return todo;
  }

  delete(id: string): boolean {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.todos.splice(index, 1);
      this.notify();
      return true;
    }
    return false;
  }

  clearCompleted(): number {
    const initialLength = this.todos.length;
    this.todos = this.todos.filter((t) => !t.completed);
    const removed = initialLength - this.todos.length;
    if (removed > 0) this.notify();
    return removed;
  }

  setFilter(filter: FilterType): void {
    this.filter = filter;
    this.notify();
  }

  getFilter(): FilterType {
    return this.filter;
  }

  subscribe(observer: () => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  private notify(): void {
    this.observers.forEach((observer) => observer());
  }
}

// ============================================
// Views
// ============================================

// Console View
class ConsoleTodoView {
  render(todos: Todo[], stats: { total: number; active: number; completed: number }, filter: FilterType): void {
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║              TODO APPLICATION            ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  Total: ${stats.total.toString().padEnd(3)} │ Active: ${stats.active.toString().padEnd(3)} │ Done: ${stats.completed.toString().padEnd(3)} ║`);
    console.log("╠══════════════════════════════════════════╣");

    if (todos.length === 0) {
      console.log("║  No todos to display                     ║");
    } else {
      todos.forEach((todo) => {
        const status = todo.completed ? "[✓]" : "[ ]";
        const priority = { high: "🔴", medium: "🟡", low: "🟢" }[todo.priority];
        const title = todo.title.substring(0, 25).padEnd(25);
        console.log(`║  ${status} ${priority} ${title}     ║`);
      });
    }

    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  Filter: ${filter.toUpperCase().padEnd(32)} ║`);
    console.log("╚══════════════════════════════════════════╝");
  }

  showMessage(message: string): void {
    console.log(`\n  → ${message}`);
  }

  showError(error: string): void {
    console.log(`\n  ✗ ERROR: ${error}`);
  }
}

// Stats View (separate view component)
class StatsView {
  render(stats: { total: number; active: number; completed: number }): void {
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    const bar = this.createProgressBar(percentage);

    console.log("\n┌─────────────────────────────────────┐");
    console.log("│           PROGRESS STATS            │");
    console.log("├─────────────────────────────────────┤");
    console.log(`│  ${bar} ${percentage}%          │`);
    console.log(`│  ${stats.completed}/${stats.total} tasks completed             │`);
    console.log("└─────────────────────────────────────┘");
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  }
}

// ============================================
// Controller
// ============================================

class TodoController {
  private consoleView: ConsoleTodoView;
  private statsView: StatsView;

  constructor(private model: TodoModel) {
    this.consoleView = new ConsoleTodoView();
    this.statsView = new StatsView();

    // Subscribe to model changes
    model.subscribe(() => this.updateView());
  }

  private updateView(): void {
    this.consoleView.render(this.model.getAll(), this.model.getStats(), this.model.getFilter());
    this.statsView.render(this.model.getStats());
  }

  // Actions
  showAll(): void {
    console.log("\n[Controller] Show all todos");
    this.model.setFilter("all");
  }

  showActive(): void {
    console.log("\n[Controller] Show active todos");
    this.model.setFilter("active");
  }

  showCompleted(): void {
    console.log("\n[Controller] Show completed todos");
    this.model.setFilter("completed");
  }

  addTodo(title: string, priority: Todo["priority"] = "medium"): void {
    console.log(`\n[Controller] Adding todo: "${title}"`);

    if (!title.trim()) {
      this.consoleView.showError("Title cannot be empty");
      return;
    }

    const todo = this.model.add(title, priority);
    this.consoleView.showMessage(`Added: "${todo.title}"`);
  }

  toggleTodo(id: string): void {
    console.log(`\n[Controller] Toggling todo ${id}`);
    const todo = this.model.toggle(id);
    if (todo) {
      this.consoleView.showMessage(`${todo.completed ? "Completed" : "Reactivated"}: "${todo.title}"`);
    } else {
      this.consoleView.showError("Todo not found");
    }
  }

  deleteTodo(id: string): void {
    console.log(`\n[Controller] Deleting todo ${id}`);
    if (this.model.delete(id)) {
      this.consoleView.showMessage("Todo deleted");
    } else {
      this.consoleView.showError("Todo not found");
    }
  }

  clearCompleted(): void {
    console.log("\n[Controller] Clearing completed todos");
    const count = this.model.clearCompleted();
    this.consoleView.showMessage(`Cleared ${count} completed todo(s)`);
  }

  // Initial render
  initialize(): void {
    console.log("[Controller] Initializing application");
    this.updateView();
  }
}

// ============================================
// Demo
// ============================================

function demo() {
  console.log("=== MVC Pattern - Todo App Demo ===\n");

  const model = new TodoModel();
  const controller = new TodoController(model);

  // Initialize
  controller.initialize();

  // User interactions
  controller.addTodo("Study design patterns", "high");
  controller.addTodo("Write documentation", "medium");
  controller.addTodo("Fix bugs", "low");

  // Toggle some
  controller.toggleTodo("1");

  // Filter views
  controller.showActive();
  controller.showCompleted();
  controller.showAll();

  // Clear completed
  controller.clearCompleted();

  // Final view
  controller.showAll();
}

demo();
