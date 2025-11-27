import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { randomUUID } from 'crypto';

// Simple sentiment analysis (can be improved with a proper library)
function analyzeSentiment(text: string): number {
  const positiveWords = ['great', 'good', 'awesome', 'excellent', 'perfect', 'thanks', 'thank you', 'amazing', 'love'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'disappointed', 'poor'];

  const lowerText = text.toLowerCase();
  let score = 0.5; // neutral

  positiveWords.forEach(word => {
    if (lowerText.includes(word)) score += 0.05;
  });

  negativeWords.forEach(word => {
    if (lowerText.includes(word)) score -= 0.05;
  });

  return Math.max(0, Math.min(1, score));
}

export async function POST(req: Request) {
  try {
    const { sessionId, shopDomain, role, content, hasImages } = await req.json();

    if (!sessionId || !shopDomain || !role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get or create conversation
    let conversation = db.prepare(
      'SELECT * FROM conversations WHERE session_id = ?'
    ).get(sessionId) as any;

    if (!conversation) {
      const conversationId = randomUUID();
      db.prepare(`
        INSERT INTO conversations (id, session_id, shop_domain, started_at, is_active)
        VALUES (?, ?, ?, datetime('now'), 1)
      `).run(conversationId, sessionId, shopDomain);

      conversation = { id: conversationId, session_id: sessionId };
    }

    // Analyze sentiment
    const sentiment = analyzeSentiment(content);

    // Insert message
    const messageId = randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, has_images, sentiment_score, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(messageId, conversation.id, role, content, hasImages ? 1 : 0, sentiment);

    // Update conversation
    const messageCount = db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
    ).get(conversation.id) as { count: number };

    const avgSentiment = db.prepare(
      'SELECT AVG(sentiment_score) as avg FROM messages WHERE conversation_id = ? AND sentiment_score IS NOT NULL'
    ).get(conversation.id) as { avg: number };

    db.prepare(`
      UPDATE conversations
      SET message_count = ?, sentiment_score = ?
      WHERE id = ?
    `).run(messageCount.count, avgSentiment.avg || 0.5, conversation.id);

    return NextResponse.json({ success: true, messageId, conversationId: conversation.id });
  } catch (error) {
    console.error('Error tracking conversation:', error);
    return NextResponse.json({ error: 'Failed to track conversation' }, { status: 500 });
  }
}
