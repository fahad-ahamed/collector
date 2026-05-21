import { NextRequest, NextResponse } from "next/server";
import { findSessionById, updateSession, findFilesBySessionId, deleteFileById } from "@/lib/db";
import fs from "fs";
import path from "path";

// POST /api/sessions/delete-contacts - Delete all contacts data from a session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, accessCode } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Validate sessionId
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    if (!accessCode) {
      return NextResponse.json({ error: "Access code required" }, { status: 401 });
    }

    // Validate access code
    const MASTER_CODE = process.env.MASTER_CODE || "32423";
    const passwordDir = path.join(process.cwd(), "app session password");
    const masterCodeFile = path.join(passwordDir, "master_code.txt");
    let masterCode = MASTER_CODE;
    try {
      if (fs.existsSync(masterCodeFile)) {
        masterCode = fs.readFileSync(masterCodeFile, "utf-8").trim();
      }
    } catch {}

    const sessionCodeFile = path.join(passwordDir, `${sessionId}.txt`);
    let sessionCode = "";
    try {
      if (fs.existsSync(sessionCodeFile)) {
        sessionCode = fs.readFileSync(sessionCodeFile, "utf-8").trim();
      }
    } catch {}

    // Also check session JSON for accessCode
    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const storedAccessCode = sessionCode || (session as any).accessCode || "";

    if (accessCode !== masterCode && accessCode !== storedAccessCode) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 403 });
    }

    // Delete all contacts data
    const previousCount = session.count;
    await updateSession(sessionId, {
      contacts: JSON.stringify([]),
      count: 0,
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${previousCount} contacts`,
      deletedCount: previousCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Delete contacts error:", message);
    return NextResponse.json({ error: "Failed to delete contacts" }, { status: 500 });
  }
}

