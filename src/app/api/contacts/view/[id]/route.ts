import { NextRequest, NextResponse } from "next/server";
import { findSessionById, findFilesBySessionId } from "@/lib/db";

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

    const uploadedFiles = await findFilesBySessionId(id);

    const contacts = JSON.parse(session.contacts);
    const files = JSON.parse(session.files);

    // Map uploaded files with their download URLs
    const mappedUploadedFiles = uploadedFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      filePath: f.filePath,
      fileSize: f.fileSize,
      fileType: f.fileType,
      downloadUrl: `/api/files/file/${f.id}`,
      uploadedAt: f.uploadedAt,
    }));

    return NextResponse.json({
      id: session.id,
      contacts,
      files,
      uploadedFiles: mappedUploadedFiles,
      appName: session.appName,
      count: session.count,
      fileCount: session.fileCount,
      createdAt: session.createdAt,
    });
  } catch (error: unknown) {
    console.error("View error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve data" },
      { status: 500 }
    );
  }
}
