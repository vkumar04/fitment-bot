import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'dev.db');
const db = new Database(dbPath);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    shop_domain TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    message_count INTEGER DEFAULT 0,
    sentiment_score REAL DEFAULT 0.5,
    is_active INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_shop_domain ON conversations(shop_domain);
  CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at);
  CREATE INDEX IF NOT EXISTS idx_conversations_is_active ON conversations(is_active);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    has_images INTEGER DEFAULT 0,
    sentiment_score REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

  CREATE TABLE IF NOT EXISTS daily_metrics (
    id TEXT PRIMARY KEY,
    date TEXT UNIQUE NOT NULL,
    shop_domain TEXT NOT NULL,
    total_conversations INTEGER DEFAULT 0,
    active_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    average_sentiment REAL DEFAULT 0.5
  );

  CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
  CREATE INDEX IF NOT EXISTS idx_daily_metrics_shop_domain ON daily_metrics(shop_domain);
`);

export default db;
