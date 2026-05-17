import { NextResponse } from "next/server";
import { getAllSessions, deleteSessionById, findSessionById, updateSession } from "@/lib/db";
import fs from "fs";
import path from "path";

// ─── Master Code (stored in app session password folder) ───
const MASTER_CODE = process.env.MASTER_CODE || "32423";

function getMasterCode(): string {
  // Try reading from app session password folder first
  const passwordDir = path.join(process.cwd(), "app session password");
  const masterCodeFile = path.join(passwordDir, "master_code.txt");
  try {
    if (fs.existsSync(masterCodeFile)) {
      return fs.readFileSync(masterCodeFile, "utf-8").trim();
    }
  } catch {}
  return MASTER_CODE;
}

function isMasterCode(code: string): boolean {
  return code === getMasterCode();
}

function getSessionAccessCode(sessionId: string): string | null {
  const passwordDir = path.join(process.cwd(), "app session password");
  const sessionCodeFile = path.join(passwordDir, `${sessionId}.txt`);
  try {
    if (fs.existsSync(sessionCodeFile)) {
      return fs.readFileSync(sessionCodeFile, "utf-8").trim();
    }
  } catch {}
  // Fallback: check session JSON for accessCode field
  try {
    const session = findSessionByIdSync(sessionId);
    if (session && (session as any).accessCode) {
      return (session as any).accessCode;
    }
  } catch {}
  return null;
}

function findSessionByIdSync(id: string): any | null {
  const dbDir = process.env.DB_DIR || path.join(process.cwd(), "db");
  const filePath = path.join(dbDir, "sessions", `${id}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function deleteSessionAccessCode(sessionId: string): void {
  const passwordDir = path.join(process.cwd(), "app session password");
  const sessionCodeFile = path.join(passwordDir, `${sessionId}.txt`);
  try {
    if (fs.existsSync(sessionCodeFile)) {
      fs.unlinkSync(sessionCodeFile);
    }
  } catch {}
}

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
      const accessCode = getSessionAccessCode(session.id);

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
        accessCode: accessCode || undefined,
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

// DELETE /api/sessions - Delete a session (requires access code or master code)
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, accessCode } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Validate access code
    if (!accessCode) {
      return NextResponse.json({ error: "Access code required" }, { status: 401 });
    }

    // Check if it's the master code
    if (isMasterCode(accessCode)) {
      // Master code can delete any session
      const deleted = await deleteSessionById(sessionId);
      if (!deleted) {
        return NextResponse.json({ error: "Session not found or delete failed" }, { status: 404 });
      }
      deleteSessionAccessCode(sessionId);
      return NextResponse.json({ success: true, message: "Session deleted successfully" });
    }

    // Check if it's the session's own access code
    const storedCode = getSessionAccessCode(sessionId);
    if (!storedCode || accessCode !== storedCode) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 403 });
    }

    const deleted = await deleteSessionById(sessionId);
    if (!deleted) {
      return NextResponse.json({ error: "Session not found or delete failed" }, { status: 404 });
    }

    // Delete the access code file too
    deleteSessionAccessCode(sessionId);

    return NextResponse.json({ success: true, message: "Session deleted successfully" });
  } catch (error: unknown) {
    console.error("Session delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
