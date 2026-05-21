import { NextRequest, NextResponse } from "next/server";
import { findSessionById, updateSession, findFilesBySessionId, deleteFileById } from "@/lib/db";
import fs from "fs";
import path from "path";

// POST /api/sessions/delete-files - Delete all files data from a session
// Optional: fileType filter to delete only specific type (image, video, audio, pdf, document, etc.)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, accessCode, fileType } = body;

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

    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const storedAccessCode = sessionCode || (session as any).accessCode || "";

    if (accessCode !== masterCode && accessCode !== storedAccessCode) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 403 });
    }

    const uploadedFiles = await findFilesBySessionId(sessionId);

    if (fileType) {
      // Delete only files of specific type
      const filesToDelete = uploadedFiles.filter(f => f.fileType === fileType);
      for (const file of filesToDelete) {
        await deleteFileById(file.id);
      }

      // Update session file metadata - remove deleted files from the JSON
      let sessionFiles: any[] = [];
      try { sessionFiles = JSON.parse(session.files); } catch { sessionFiles = []; }
      sessionFiles = sessionFiles.filter((f: any) => f.fileType !== fileType);

      await updateSession(sessionId, {
        files: JSON.stringify(sessionFiles),
        fileCount: sessionFiles.length,
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${filesToDelete.length} ${fileType} files`,
        deletedCount: filesToDelete.length,
        fileType,
      });
    } else {
      // Delete ALL files
      for (const file of uploadedFiles) {
        await deleteFileById(file.id);
      }

      await updateSession(sessionId, {
        files: JSON.stringify([]),
        fileCount: 0,
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${uploadedFiles.length} files`,
        deletedCount: uploadedFiles.length,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Delete files error:", message);
    return NextResponse.json({ error: "Failed to delete files" }, { status: 500 });
  }
}

