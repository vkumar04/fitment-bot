import { NextResponse } from "next/server";
import db from "@/lib/db";

// Add CORS headers for cross-origin requests (Shopify)
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, sessionId, data } = body;

    if (action === "start_session") {
      const { source, sourceDomain } = data;

      const stmt = db.prepare(`
        INSERT INTO sessions (id, start_time, status, source, source_domain)
        VALUES (?, datetime('now'), 'active', ?, ?)
      `);
      stmt.run(sessionId, source || "standalone", sourceDomain || null);

      return NextResponse.json(
        { success: true },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    if (action === "end_session") {
      const { sentiment } = data;

      const stmt = db.prepare(`
        UPDATE sessions
        SET end_time = datetime('now'), status = 'completed', sentiment = ?
        WHERE id = ?
      `);
      stmt.run(sentiment || 0.5, sessionId);

      return NextResponse.json(
        { success: true },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    if (action === "track_message") {
      const { role, contentLength } = data;

      // Insert message
      const msgStmt = db.prepare(`
        INSERT INTO messages (session_id, role, content_length)
        VALUES (?, ?, ?)
      `);
      msgStmt.run(sessionId, role, contentLength || 0);

      // Update session message count
      const updateStmt = db.prepare(`
        UPDATE sessions
        SET message_count = message_count + 1
        WHERE id = ?
      `);
      updateStmt.run(sessionId);

      return NextResponse.json(
        { success: true },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    return NextResponse.json(
      { error: "Invalid action" },
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
