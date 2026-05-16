import { NextRequest, NextResponse } from "next/server";
import { updateSessionHeartbeat, findSessionById } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const updated = await updateSessionHeartbeat(sessionId);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update heartbeat" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status: updated.status,
      lastHeartbeat: updated.lastHeartbeat,
    });
  } catch (error: unknown) {
    console.error("Heartbeat error:", error);
    return NextResponse.json(
      { error: "Failed to process heartbeat" },
      { status: 500 }
    );
  }
}
