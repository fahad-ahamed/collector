import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const UPLOAD_DIR = "/home/z/my-project/uploaded-files";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionId = formData.get("sessionId") as string;
    const filePath = formData.get("filePath") as string;
    const fileType = formData.get("fileType") as string || "other";
    const file = formData.get("file") as File | null;

    if (!sessionId || !file) {
      return NextResponse.json(
        { error: "sessionId and file are required" },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.contactSession.findUnique({
      where: { id: sessionId },
    });
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
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        sessionId,
        filePath: filePath || file.name,
        fileName: file.name,
        fileSize: buffer.length,
        fileType,
        serverPath,
      },
    });

    return NextResponse.json({
      id: uploadedFile.id,
      fileName: uploadedFile.fileName,
      fileSize: uploadedFile.fileSize,
      fileType: uploadedFile.fileType,
      serverPath: uploadedFile.serverPath,
    });
  } catch (error: any) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: error.message },
      { status: 500 }
    );
  }
}
