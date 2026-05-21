import { NextRequest, NextResponse } from "next/server";
import { findSessionById, storeNotifications } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, deviceId, notifications } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return NextResponse.json(
        { error: "notifications array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Validate notifications array size
    if (notifications.length > 100) {
      return NextResponse.json(
        { error: "Too many notifications per batch. Maximum 100." },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Store notifications
    const storedCount = await storeNotifications(sessionId, deviceId, notifications);

    return NextResponse.json({
      success: true,
      sessionId,
      storedCount,
      receivedCount: notifications.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Notification upload error:", message);
    return NextResponse.json(
      { error: "Failed to store notifications", details: message },
      { status: 500 }
    );
  }
}

