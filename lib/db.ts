import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "analytics.db");

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT,
    message_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    sentiment REAL DEFAULT 0.5,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content_length INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
`);

// Migration: Add source columns if they don't exist
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN source TEXT DEFAULT 'standalone'`);
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN source_domain TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Create index for source after adding column
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source)`);
} catch (e) {
  // Index might already exist, ignore
}

export default db;
