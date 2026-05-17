import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MASTER_CODE = process.env.MASTER_CODE || "32423";

function getMasterCode(): string {
  const passwordDir = path.join(process.cwd(), "app session password");
  const masterCodeFile = path.join(passwordDir, "master_code.txt");
  try {
    if (fs.existsSync(masterCodeFile)) {
      return fs.readFileSync(masterCodeFile, "utf-8").trim();
    }
  } catch {}
  return MASTER_CODE;
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
  const dbDir = process.env.DB_DIR || path.join(process.cwd(), "db");
  const sessionFile = path.join(dbDir, "sessions", `${sessionId}.json`);
  try {
    if (fs.existsSync(sessionFile)) {
      const session = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
      if (session.accessCode) return session.accessCode;
    }
  } catch {}
  return null;
}

// POST /api/sessions/validate-access - Validate session access code
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, accessCode } = body;

    if (!sessionId || !accessCode) {
      return NextResponse.json({ error: "Session ID and access code required", valid: false }, { status: 400 });
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID", valid: false }, { status: 400 });
    }

    // Check master code first
    if (accessCode === getMasterCode()) {
      return NextResponse.json({ valid: true });
    }

    // Check session-specific access code
    const storedCode = getSessionAccessCode(sessionId);
    if (!storedCode) {
      // No access code set for this session - allow access (legacy sessions)
      return NextResponse.json({ valid: true });
    }

    if (accessCode === storedCode) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ error: "Invalid access code", valid: false }, { status: 403 });
  } catch (error: unknown) {
    console.error("Validate access error:", error);
    return NextResponse.json({ error: "Validation failed", valid: false }, { status: 500 });
  }
}
