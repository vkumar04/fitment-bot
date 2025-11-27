"use server";

import db from "@/lib/db";

export async function startSession(
  sessionId: string,
  source: string = "standalone",
  sourceDomain?: string,
) {
  try {
    const stmt = db.prepare(`
      INSERT INTO sessions (id, start_time, status, source, source_domain)
      VALUES (?, datetime('now'), 'active', ?, ?)
    `);
    stmt.run(sessionId, source, sourceDomain || null);
    return { success: true };
  } catch (error) {
    console.error("Error starting session:", error);
    return { success: false, error: String(error) };
  }
}

export async function endSession(sessionId: string, sentiment: number = 0.5) {
  try {
    const stmt = db.prepare(`
      UPDATE sessions
      SET end_time = datetime('now'), status = 'completed', sentiment = ?
      WHERE id = ?
    `);
    stmt.run(sentiment, sessionId);
    return { success: true };
  } catch (error) {
    console.error("Error ending session:", error);
    return { success: false, error: String(error) };
  }
}

export async function trackMessage(
  sessionId: string,
  role: "user" | "assistant",
  contentLength: number,
) {
  try {
    // Insert message
    const msgStmt = db.prepare(`
      INSERT INTO messages (session_id, role, content_length)
      VALUES (?, ?, ?)
    `);
    msgStmt.run(sessionId, role, contentLength);

    // Update session message count
    const updateStmt = db.prepare(`
      UPDATE sessions
      SET message_count = message_count + 1
      WHERE id = ?
    `);
    updateStmt.run(sessionId);

    return { success: true };
  } catch (error) {
    console.error("Error tracking message:", error);
    return { success: false, error: String(error) };
  }
}

export async function getAnalytics(sourceFilter?: string) {
  try {
    const sourceCondition = sourceFilter ? `WHERE source = ?` : "";
    const sourceParams = sourceFilter ? [sourceFilter] : [];

    // Total conversations
    const totalResult = db
      .prepare(`SELECT COUNT(*) as count FROM sessions ${sourceCondition}`)
      .get(...sourceParams) as { count: number };
    const total = totalResult.count;

    // Today's conversations
    const todayResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sessions
      WHERE DATE(created_at) = DATE('now')
      ${sourceFilter ? "AND source = ?" : ""}
    `,
      )
      .get(...sourceParams) as { count: number };
    const today = todayResult.count;

    // Active now
    const activeResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sessions
      WHERE status = 'active'
      ${sourceFilter ? "AND source = ?" : ""}
    `,
      )
      .get(...sourceParams) as { count: number };
    const active = activeResult.count;

    // Average sentiment
    const sentimentResult = db
      .prepare(
        `
      SELECT AVG(sentiment) as avg
      FROM sessions
      WHERE sentiment IS NOT NULL
      ${sourceFilter ? "AND source = ?" : ""}
    `,
      )
      .get(...sourceParams) as { avg: number | null };
    const avgSentiment = sentimentResult.avg || 0.5;

    // Calculate percentage changes (comparing to yesterday)
    const yesterdayResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM sessions
      WHERE DATE(created_at) = DATE('now', '-1 day')
      ${sourceFilter ? "AND source = ?" : ""}
    `,
      )
      .get(...sourceParams) as { count: number };
    const yesterday = yesterdayResult.count;

    const totalChange =
      yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;
    const todayChange =
      yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;

    // Get source breakdown
    const sourceBreakdown = db
      .prepare(
        `
      SELECT
        source,
        source_domain,
        COUNT(*) as count,
        AVG(message_count) as avg_messages
      FROM sessions
      GROUP BY source, source_domain
      ORDER BY count DESC
    `,
      )
      .all() as Array<{
      source: string;
      source_domain: string | null;
      count: number;
      avg_messages: number;
    }>;

    // Get recent conversations
    const recentSessions = db
      .prepare(
        `
      SELECT
        id,
        start_time,
        end_time,
        message_count,
        status,
        source,
        source_domain,
        created_at
      FROM sessions
      ${sourceCondition}
      ORDER BY created_at DESC
      LIMIT 20
    `,
      )
      .all(...sourceParams) as Array<{
      id: string;
      start_time: string;
      end_time: string | null;
      message_count: number;
      status: string;
      source: string;
      source_domain: string | null;
      created_at: string;
    }>;

    return {
      success: true,
      data: {
        total,
        totalChange,
        today,
        todayChange,
        active,
        avgSentiment,
        sentimentChange: 0.18,
        sourceBreakdown,
        recentSessions,
      },
    };
  } catch (error) {
    console.error("Error getting analytics:", error);
    return { success: false, error: String(error) };
  }
}
