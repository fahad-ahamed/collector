import { NextRequest, NextResponse } from "next/server";
import { findSessionById, findNotificationsBySessionId, deleteNotificationsBySessionId, getNotificationCountBySessionId } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Validate sessionId
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Verify session exists
    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get query params for pagination
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const searchQuery = url.searchParams.get("q") || "";
    const packageName = url.searchParams.get("app") || "";

    // Fetch notifications
    let notifications = await findNotificationsBySessionId(sessionId);

    // Filter by package name if specified
    if (packageName) {
      notifications = notifications.filter(n => n.packageName === packageName);
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      notifications = notifications.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.text.toLowerCase().includes(q) ||
        n.appName.toLowerCase().includes(q) ||
        (n.bigText && n.bigText.toLowerCase().includes(q))
      );
    }

    const total = notifications.length;
    const paginated = notifications.slice(offset, offset + limit);

    // Get unique package names for filter
    const uniqueApps = [...new Set(notifications.map(n => n.packageName))].sort();

    return NextResponse.json({
      notifications: paginated,
      total,
      limit,
      offset,
      apps: uniqueApps,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Notification fetch error:", message);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Validate sessionId
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const deleted = await deleteNotificationsBySessionId(sessionId);
    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "All notifications deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Notification delete error:", message);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}

