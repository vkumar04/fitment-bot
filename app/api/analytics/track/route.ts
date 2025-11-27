import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Simple file-based storage for analytics
const ANALYTICS_DIR = path.join(process.cwd(), 'data', 'analytics');
const SESSIONS_FILE = path.join(ANALYTICS_DIR, 'sessions.json');
const MESSAGES_FILE = path.join(ANALYTICS_DIR, 'messages.json');

// Ensure directory exists
function ensureAnalyticsDir() {
  if (!fs.existsSync(ANALYTICS_DIR)) {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
  }
  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
  }
}

interface Session {
  id: string;
  startTime: string;
  endTime?: string;
  messageCount: number;
  status: 'active' | 'completed';
  sentiment?: number;
}

interface Message {
  sessionId: string;
  timestamp: string;
  role: 'user' | 'assistant';
  messageLength: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, sessionId, data } = body;

    ensureAnalyticsDir();

    if (type === 'session_start') {
      // Start a new session
      const sessions: Session[] = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));

      const newSession: Session = {
        id: sessionId,
        startTime: new Date().toISOString(),
        messageCount: 0,
        status: 'active',
      };

      sessions.push(newSession);
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));

      return NextResponse.json({ success: true });
    }

    if (type === 'session_end') {
      // End a session
      const sessions: Session[] = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      const session = sessions.find(s => s.id === sessionId);

      if (session) {
        session.endTime = new Date().toISOString();
        session.status = 'completed';
        session.sentiment = data?.sentiment || 0.5;
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'message') {
      // Track a message
      const messages: Message[] = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
      const sessions: Session[] = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));

      const newMessage: Message = {
        sessionId,
        timestamp: new Date().toISOString(),
        role: data.role,
        messageLength: data.messageLength || 0,
      };

      messages.push(newMessage);
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

      // Update session message count
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        session.messageCount++;
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
