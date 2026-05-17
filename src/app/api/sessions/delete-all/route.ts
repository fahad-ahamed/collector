import { NextResponse } from "next/server";
import { getAllSessions, deleteSessionById } from "@/lib/db";
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

// POST /api/sessions/delete-all - Delete all sessions (master code required)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { masterCode } = body;

    if (!masterCode) {
      return NextResponse.json({ error: "Master code required" }, { status: 400 });
    }

    if (masterCode !== getMasterCode()) {
      return NextResponse.json({ error: "Invalid master code" }, { status: 403 });
    }

    // Delete all sessions
    const sessions = await getAllSessions();
    let deletedCount = 0;
    let failedCount = 0;

    for (const session of sessions) {
      try {
        const deleted = await deleteSessionById(session.id);
        if (deleted) {
          deletedCount++;
          // Also delete the access code file
          const passwordDir = path.join(process.cwd(), "app session password");
          const sessionCodeFile = path.join(passwordDir, `${session.id}.txt`);
          try {
            if (fs.existsSync(sessionCodeFile)) {
              fs.unlinkSync(sessionCodeFile);
            }
          } catch {}
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} sessions${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      deletedCount,
      failedCount,
    });
  } catch (error: unknown) {
    console.error("Delete all sessions error:", error);
    return NextResponse.json({ error: "Failed to delete all sessions" }, { status: 500 });
  }
}
