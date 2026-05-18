# 03. Database Design & Models

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100),
  location VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lastActivity TIMESTAMP
);
```

### Chat History Table
```sql
CREATE TABLE chat_history (
  id VARCHAR(36) PRIMARY KEY,
  sessionId VARCHAR(36) REFERENCES sessions(id),
  userMessage TEXT,
  aiResponse TEXT,
  aiProvider VARCHAR(20),
  tokensUsed INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Properties Table
```sql
CREATE TABLE properties (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(50),
  transaction VARCHAR(20),
  location VARCHAR(255),
  price DECIMAL(15,2),
  facilities JSON,
  description TEXT
);
```

### Contacts Table
```sql
CREATE TABLE contacts (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  message TEXT,
  status VARCHAR(50) DEFAULT 'new',
  submittedAt TIMESTAMP
);
```

## JavaScript Models

### Session Model
```javascript
class Session {
  constructor(data) {
    this.id = data.id || uuid();
    this.phone = data.phone;
    this.name = data.name;
    this.location = data.location;
    this.history = [];
    this.createdAt = new Date();
  }
}
```

## Data Relationships

```
Session (1) ──→ (Many) ChatHistory
Session (1) ──→ (Many) Contacts
Property → Multiple recommendations
```

## Indexes

```sql
CREATE INDEX idx_sessions_phone ON sessions(phone);
CREATE INDEX idx_history_sessionId ON chat_history(sessionId);
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_location ON properties(location);
```

## Migration Strategy

Migrations are idempotent - safe to run multiple times:
```javascript
// config/migrations.js handles table creation automatically
```
