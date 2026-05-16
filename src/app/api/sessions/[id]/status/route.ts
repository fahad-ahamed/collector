import { NextRequest, NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import type { DeviceInfo } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const session = await findSessionById(id);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const now = Date.now();
    // IMMORTAL: Use 120 seconds for isOnline display check
    // But NEVER permanently mark session as offline in the database
    // When heartbeat comes back, session automatically becomes live_connected again
    const isOnline = !!(
      session.lastHeartbeat &&
      now - new Date(session.lastHeartbeat).getTime() < 120000
    );

    // Build device list with online status
    const devices: Record<string, DeviceInfo & { isOnline: boolean }> = {};
    if (session.devices) {
      for (const [deviceId, device] of Object.entries(session.devices)) {
        const deviceOnline = !!(
          device.lastHeartbeat &&
          now - new Date(device.lastHeartbeat).getTime() < 120000
        );
        devices[deviceId] = { ...device, isOnline: deviceOnline };
      }
    }

    // Determine display status:
    // - If heartbeat is fresh -> show actual status (or live_connected)
    // - If heartbeat is stale -> show "offline" in UI only, not in database
    // This means when the device comes back online after days/weeks, the
    // heartbeat API will restore it to live_connected automatically
    let displayStatus = session.status;
    if (isOnline) {
      if (session.status === 'offline') {
        displayStatus = 'live_connected';
      }
    } else {
      if (session.status !== 'apk_built' && session.status !== 'waiting_install') {
        displayStatus = 'offline';
      }
    }

    return NextResponse.json({
      id: session.id,
      status: displayStatus,
      statusHistory: session.statusHistory || [],
      lastHeartbeat: session.lastHeartbeat || null,
      buildId: session.buildId || null,
      isOnline,
      devices,
    });
  } catch (error: unknown) {
    console.error("Session status error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve session status" },
      { status: 500 }
    );
  }
}
