import { NextResponse } from "next/server";
import { getAllSessions, deleteSessionById } from "@/lib/db";

export async function GET() {
  try {
    const sessions = await getAllSessions();

    const now = Date.now();
    const sessionsWithStatus = sessions.map((session) => {
      const isOnline = !!(
        session.lastHeartbeat &&
        now - new Date(session.lastHeartbeat).getTime() < 60000
      );

      const deviceCount = session.devices ? Object.keys(session.devices).length : 0;

      return {
        id: session.id,
        appName: session.appName,
        count: session.count,
        fileCount: session.fileCount,
        createdAt: session.createdAt,
        status: session.status || null,
        statusHistory: session.statusHistory || [],
        lastHeartbeat: session.lastHeartbeat || null,
        buildId: session.buildId || null,
        isOnline,
        deviceCount,
      };
    });

    return NextResponse.json(sessionsWithStatus);
  } catch (error: unknown) {
    console.error("Sessions list error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve sessions" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions - Delete a session
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const deleted = await deleteSessionById(sessionId);
    if (!deleted) {
      return NextResponse.json({ error: "Session not found or delete failed" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Session deleted successfully" });
  } catch (error: unknown) {
    console.error("Session delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
