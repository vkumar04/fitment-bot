import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 },
      );
    }

    // Mark conversation as inactive
    const { error } = await supabase
      .from("conversations")
      .update({ is_active: false })
      .eq("session_id", sessionId);

    if (error) {
      console.error("Error deactivating conversation:", error);
      return NextResponse.json(
        { error: "Failed to deactivate conversation" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in deactivate endpoint:", error);
    return NextResponse.json(
      { error: "Failed to deactivate conversation" },
      { status: 500 },
    );
  }
}
