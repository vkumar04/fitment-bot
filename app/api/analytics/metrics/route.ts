import { NextResponse } from 'next/server';
import db from '@/app/lib/db';

export async function GET() {
  try {
    // Get total conversations
    const totalConversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };

    // Get today's conversations
    const today = new Date().toISOString().split('T')[0];
    const todayConversations = db.prepare(
      'SELECT COUNT(*) as count FROM conversations WHERE DATE(started_at) = ?'
    ).get(today) as { count: number };

    // Get active conversations
    const activeConversations = db.prepare(
      'SELECT COUNT(*) as count FROM conversations WHERE is_active = 1'
    ).get() as { count: number };

    // Get average sentiment
    const sentimentData = db.prepare(
      'SELECT AVG(sentiment_score) as avg FROM conversations WHERE sentiment_score IS NOT NULL'
    ).get() as { avg: number | null };

    // Get shop breakdown
    const shopBreakdown = db.prepare(`
      SELECT shop_domain, COUNT(*) as session_count
      FROM conversations
      GROUP BY shop_domain
      ORDER BY session_count DESC
    `).all() as Array<{ shop_domain: string; session_count: number }>;

    // Get recent conversations with details
    const recentConversations = db.prepare(`
      SELECT
        c.id,
        c.session_id,
        c.shop_domain,
        c.started_at,
        c.message_count,
        c.sentiment_score,
        c.is_active
      FROM conversations c
      ORDER BY c.started_at DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      totalConversations: totalConversations.count,
      todayConversations: todayConversations.count,
      activeConversations: activeConversations.count,
      averageSentiment: sentimentData.avg || 0.5,
      shopBreakdown,
      recentConversations
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
