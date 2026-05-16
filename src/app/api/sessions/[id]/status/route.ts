import { NextRequest, NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import type { DeviceInfo } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format to prevent path traversal
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
    const isOnline = !!(
      session.lastHeartbeat &&
      now - new Date(session.lastHeartbeat).getTime() < 60000
    );

    // Build device list with online status
    const devices: Record<string, DeviceInfo & { isOnline: boolean }> = {};
    if (session.devices) {
      for (const [deviceId, device] of Object.entries(session.devices)) {
        const deviceOnline = !!(
          device.lastHeartbeat &&
          now - new Date(device.lastHeartbeat).getTime() < 60000
        );
        devices[deviceId] = { ...device, isOnline: deviceOnline };
      }
    }

    return NextResponse.json({
      id: session.id,
      status: session.status || null,
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
