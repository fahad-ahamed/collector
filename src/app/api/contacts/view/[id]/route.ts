import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await prisma.contactSession.findUnique({
      where: { id },
      include: { uploadedFiles: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const contacts = JSON.parse(session.contacts);
    const files = JSON.parse(session.files);

    // Map uploaded files with their download URLs
    const uploadedFiles = session.uploadedFiles.map(f => ({
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
      uploadedFiles,
      appName: session.appName,
      count: session.count,
      fileCount: session.fileCount,
      createdAt: session.createdAt,
    });
  } catch (error: any) {
    console.error("View error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve data" },
      { status: 500 }
    );
  }
}
