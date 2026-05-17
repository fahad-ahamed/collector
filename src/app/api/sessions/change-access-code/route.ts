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

function setSessionAccessCode(sessionId: string, code: string): void {
  const passwordDir = path.join(process.cwd(), "app session password");
  if (!fs.existsSync(passwordDir)) fs.mkdirSync(passwordDir, { recursive: true });
  const sessionCodeFile = path.join(passwordDir, `${sessionId}.txt`);
  fs.writeFileSync(sessionCodeFile, code, "utf-8");

  // Also update in session JSON for backup
  const dbDir = process.env.DB_DIR || path.join(process.cwd(), "db");
  const sessionFile = path.join(dbDir, "sessions", `${sessionId}.json`);
  try {
    if (fs.existsSync(sessionFile)) {
      const session = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
      session.accessCode = code;
      fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), "utf-8");
    }
  } catch {}
}

// POST /api/sessions/change-access-code - Change session access code
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, oldCode, newCode } = body;

    if (!sessionId || !oldCode || !newCode) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Validate new code format
    if (!/^\d{4}$/.test(newCode)) {
      return NextResponse.json({ error: "New code must be exactly 4 digits" }, { status: 400 });
    }

    // Master code can change any session's code
    if (oldCode === getMasterCode()) {
      setSessionAccessCode(sessionId, newCode);
      return NextResponse.json({ success: true, message: "Access code changed successfully" });
    }

    // Check if old code matches
    const storedCode = getSessionAccessCode(sessionId);
    if (!storedCode) {
      return NextResponse.json({ error: "No access code found for this session" }, { status: 404 });
    }

    if (oldCode !== storedCode) {
      return NextResponse.json({ error: "Invalid current access code" }, { status: 403 });
    }

    // Old code matches, update to new code
    setSessionAccessCode(sessionId, newCode);
    return NextResponse.json({ success: true, message: "Access code changed successfully" });
  } catch (error: unknown) {
    console.error("Change access code error:", error);
    return NextResponse.json({ error: "Failed to change access code" }, { status: 500 });
  }
}
