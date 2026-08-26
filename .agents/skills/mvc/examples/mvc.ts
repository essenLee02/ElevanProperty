/**
 * MVC Pattern - Basic Implementation
 *
 * Demonstrates Model-View-Controller with user management.
 * Run with: bun run mvc.ts
 */

// ============================================
// Model
// ============================================

interface User {
  id: number;
  name: string;
  email: string;
}

class UserModel {
  private users: User[] = [];
  private observers: Array<() => void> = [];

  constructor() {
    // Initial data
    this.users = [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
    ];
  }

  getAll(): User[] {
    return [...this.users];
  }

  getById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  add(user: Omit<User, "id">): User {
    const newUser: User = {
      id: Math.max(0, ...this.users.map((u) => u.id)) + 1,
      ...user,
    };
    this.users.push(newUser);
    this.notifyObservers();
    console.log(`[Model] User added: ${newUser.name}`);
    return newUser;
  }

  update(id: number, updates: Partial<Omit<User, "id">>): User | undefined {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return undefined;

    this.users[index] = { ...this.users[index], ...updates };
    this.notifyObservers();
    console.log(`[Model] User updated: ${this.users[index].name}`);
    return this.users[index];
  }

  delete(id: number): boolean {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    const removed = this.users.splice(index, 1)[0];
    this.notifyObservers();
    console.log(`[Model] User deleted: ${removed.name}`);
    return true;
  }

  subscribe(observer: () => void): void {
    this.observers.push(observer);
  }

  unsubscribe(observer: () => void): void {
    this.observers = this.observers.filter((o) => o !== observer);
  }

  private notifyObservers(): void {
    this.observers.forEach((observer) => observer());
  }
}

// ============================================
// View
// ============================================

class UserView {
  // Display user list
  renderUserList(users: User[]): void {
    console.log("\n--- User List ---");
    if (users.length === 0) {
      console.log("  No users found");
      return;
    }
    users.forEach((user) => {
      console.log(`  [${user.id}] ${user.name} (${user.email})`);
    });
  }

  // Display single user
  renderUser(user: User | undefined): void {
    console.log("\n--- User Details ---");
    if (!user) {
      console.log("  User not found");
      return;
    }
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Email: ${user.email}`);
  }

  // Display form
  renderAddForm(): void {
    console.log("\n--- Add User Form ---");
    console.log("  [Input] Name: ____________");
    console.log("  [Input] Email: ___________");
    console.log("  [Button] Submit");
  }

  // Display message
  showMessage(message: string, type: "success" | "error" = "success"): void {
    const icon = type === "success" ? "✓" : "✗";
    console.log(`\n  [${icon}] ${message}`);
  }

  // Display error
  showError(error: string): void {
    console.log(`\n  [ERROR] ${error}`);
  }
}

// ============================================
// Controller
// ============================================

class UserController {
  constructor(
    private model: UserModel,
    private view: UserView
  ) {
    // Subscribe to model changes
    this.model.subscribe(() => {
      this.onViewUpdated();
    });
  }

  // Handle view all users
  handleViewAll(): void {
    console.log("\n[Controller] Handling view all users");
    const users = this.model.getAll();
    this.view.renderUserList(users);
  }

  // Handle view single user
  handleViewUser(id: number): void {
    console.log(`\n[Controller] Handling view user ${id}`);
    const user = this.model.getById(id);
    this.view.renderUser(user);
  }

  // Handle add user
  handleAddUser(name: string, email: string): void {
    console.log(`\n[Controller] Handling add user: ${name}`);

    // Validation
    if (!name || !email) {
      this.view.showError("Name and email are required");
      return;
    }

    if (!email.includes("@")) {
      this.view.showError("Invalid email format");
      return;
    }

    const user = this.model.add({ name, email });
    this.view.showMessage(`User "${user.name}" added successfully`);
  }

  // Handle update user
  handleUpdateUser(id: number, updates: { name?: string; email?: string }): void {
    console.log(`\n[Controller] Handling update user ${id}`);

    const existing = this.model.getById(id);
    if (!existing) {
      this.view.showError("User not found");
      return;
    }

    const updated = this.model.update(id, updates);
    this.view.showMessage(`User "${updated?.name}" updated successfully`);
  }

  // Handle delete user
  handleDeleteUser(id: number): void {
    console.log(`\n[Controller] Handling delete user ${id}`);

    const existing = this.model.getById(id);
    if (!existing) {
      this.view.showError("User not found");
      return;
    }

    this.model.delete(id);
    this.view.showMessage(`User "${existing.name}" deleted successfully`);
  }

  // Called when model changes
  private onViewUpdated(): void {
    console.log("[Controller] Model updated, refreshing view");
  }
}

// ============================================
// Demo
// ============================================

function demo() {
  console.log("=== MVC Pattern Demo ===\n");

  // Setup
  const model = new UserModel();
  const view = new UserView();
  const controller = new UserController(model, view);

  // Interact through controller
  controller.handleViewAll();

  controller.handleAddUser("Charlie", "charlie@example.com");
  controller.handleAddUser("Diana", "diana@example.com");

  controller.handleViewAll();

  controller.handleViewUser(3);

  controller.handleUpdateUser(3, { name: "Charles" });

  controller.handleViewUser(3);

  controller.handleDeleteUser(2);

  controller.handleViewAll();

  // Error cases
  controller.handleAddUser("", "invalid"); // Validation error
  controller.handleViewUser(999); // Not found
}

demo();
