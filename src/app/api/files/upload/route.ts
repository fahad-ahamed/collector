import { NextRequest, NextResponse } from "next/server";
import { findSessionById, createUploadedFile } from "@/lib/db";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/collector-uploads";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionId = formData.get("sessionId") as string;
    const filePath = formData.get("filePath") as string;
    const fileType = (formData.get("fileType") as string) || "other";
    const file = formData.get("file") as File | null;

    if (!sessionId || !file) {
      return NextResponse.json(
        { error: "sessionId and file are required" },
        { status: 400 }
      );
    }

    // Validate sessionId to prevent path traversal
    if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Validate file size (max 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB." },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await findSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Create session-specific upload directory
    const sessionDir = path.join(UPLOAD_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Generate unique filename to avoid collisions
    const fileExt = path.extname(file.name) || "";
    const uniqueName = `${randomUUID()}${fileExt}`;
    const serverPath = path.join(sessionId, uniqueName);
    const fullPath = path.join(UPLOAD_DIR, serverPath);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    // Save file metadata to database
    const uploadedFile = await createUploadedFile({
      sessionId,
      filePath: filePath || file.name,
      fileName: file.name,
      fileSize: buffer.length,
      fileType,
      serverPath,
    });

    return NextResponse.json({
      id: uploadedFile.id,
      fileName: uploadedFile.fileName,
      fileSize: uploadedFile.fileSize,
      fileType: uploadedFile.fileType,
      serverPath: uploadedFile.serverPath,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("File upload error:", message);
    return NextResponse.json(
      { error: "Failed to upload file", details: message },
      { status: 500 }
    );
  }
}
