import { NextRequest, NextResponse } from "next/server";
import { findFileById } from "@/lib/db";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/collector-uploads";

// Map file extensions to content types
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".3gp": "video/3gpp",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".7z": "application/x-7z-compressed",
};

// Types that should display inline in browser (preview)
const INLINE_TYPES = new Set(["image", "pdf", "text"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    // Validate fileId to prevent path traversal
    if (fileId.includes("..") || fileId.includes("/") || fileId.includes("\\")) {
      return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    const uploadedFile = await findFileById(fileId);

    if (!uploadedFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check for empty serverPath (file metadata exists but file was never uploaded)
    if (!uploadedFile.serverPath || uploadedFile.serverPath.trim() === '') {
      return NextResponse.json(
        { error: "File not available on server. It may still be syncing from the device." },
        { status: 404 }
      );
    }

    // Prevent path traversal in serverPath
    if (
      uploadedFile.serverPath.includes("..") ||
      path.isAbsolute(uploadedFile.serverPath)
    ) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const fullPath = path.join(UPLOAD_DIR, uploadedFile.serverPath);

    // Use stat to get file info without reading entire file into memory
    let fileStat;
    try {
      fileStat = fs.statSync(fullPath);
    } catch {
      return NextResponse.json(
        { error: "File not found on disk. It may have been deleted or not yet uploaded." },
        { status: 404 }
      );
    }

    const ext = path.extname(uploadedFile.fileName).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    // Use inline for viewable types (images, PDF, text), attachment for others
    const isViewable =
      INLINE_TYPES.has(uploadedFile.fileType) ||
      ext === ".pdf" ||
      ext === ".txt" ||
      ext === ".csv";

    const disposition = isViewable ? "inline" : "attachment";

    // Stream the file using Node.js ReadableStream for better memory efficiency
    const fileStream = fs.createReadStream(fullPath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${uploadedFile.fileName}"`,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error: unknown) {
    console.error("File download error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
