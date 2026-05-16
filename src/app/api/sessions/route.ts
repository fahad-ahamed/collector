import { NextResponse } from "next/server";
import { getAllSessions } from "@/lib/db";

export async function GET() {
  try {
    const sessions = await getAllSessions();

    const now = Date.now();
    const sessionsWithStatus = sessions.map((session) => {
      const isOnline = !!(
        session.lastHeartbeat &&
        now - new Date(session.lastHeartbeat).getTime() < 60000
      );

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
