import { NextRequest, NextResponse } from "next/server";
import { updateSessionStatus, findSessionById } from "@/lib/db";
import type { SessionStatus } from "@/lib/db";

const VALID_STATUSES: SessionStatus[] = [
  'apk_built',
  'waiting_install',
  'app_installed',
  'permissions_granted',
  'syncing_contacts',
  'syncing_files',
  'live_connected',
  'offline',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, status, detail } = body;

    if (!sessionId || !status) {
      return NextResponse.json(
        { error: "sessionId and status are required" },
        { status: 400 }
      );
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const updated = await updateSessionStatus(sessionId, status as SessionStatus, detail);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status: updated.status,
      statusHistory: updated.statusHistory,
    });
  } catch (error: unknown) {
    console.error("Status update error:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
