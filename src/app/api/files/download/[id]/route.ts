import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

const prisma = new PrismaClient();
const UPLOAD_DIR = "/home/z/my-project/uploaded-files";

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
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // If no uploaded files, return empty
    if (session.uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "No uploaded files available for download" },
        { status: 404 }
      );
    }

    // Create a temporary directory for the ZIP
    const zipId = randomUUID();
    const tempDir = path.join(tmpdir(), `zip-${zipId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create session folder structure in temp dir
    const sessionTempDir = path.join(tempDir, `collector-${id.slice(0, 8)}`);
    fs.mkdirSync(sessionTempDir, { recursive: true });

    // Create subdirectories for different file types
    const typeDirs: Record<string, string> = {
      image: path.join(sessionTempDir, "Images"),
      video: path.join(sessionTempDir, "Videos"),
      audio: path.join(sessionTempDir, "Audio"),
      pdf: path.join(sessionTempDir, "Documents"),
      document: path.join(sessionTempDir, "Documents"),
      other: path.join(sessionTempDir, "Other"),
    };

    for (const dir of Object.values(typeDirs)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Copy files to temp directory, organized by type
    let copiedCount = 0;
    for (const uploadedFile of session.uploadedFiles) {
      const sourcePath = path.join(UPLOAD_DIR, uploadedFile.serverPath);
      if (fs.existsSync(sourcePath)) {
        const targetDir = typeDirs[uploadedFile.fileType] || typeDirs.other;
        const ext = path.extname(uploadedFile.fileName);
        const baseName = path.basename(uploadedFile.fileName, ext);
        let targetPath = path.join(targetDir, uploadedFile.fileName);
        let counter = 1;
        while (fs.existsSync(targetPath)) {
          targetPath = path.join(targetDir, `${baseName}_${counter}${ext}`);
          counter++;
        }
        try {
          fs.copyFileSync(sourcePath, targetPath);
          copiedCount++;
        } catch (e) {
          // Skip problematic files
        }
      }
    }

    // Also export contacts as vCard
    try {
      const contacts = JSON.parse(session.contacts);
      if (Array.isArray(contacts) && contacts.length > 0) {
        const vcardContent = contacts.map((c: any) => {
          const lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${c.name || ''}`,
            `N:${c.name || ''};;;;`,
            `TEL;TYPE=CELL:${c.phone || ''}`,
          ];
          if (c.email) lines.push(`EMAIL;TYPE=HOME:${c.email}`);
          if (c.organization) lines.push(`ORG:${c.organization}`);
          lines.push('END:VCARD');
          return lines.join('\n');
        }).join('\n\n');

        fs.writeFileSync(path.join(sessionTempDir, 'contacts.vcf'), vcardContent);
      }
    } catch (e) {
      // Skip vCard export if it fails
    }

    // Create ZIP file
    const zipPath = path.join(tempDir, `collector-${id.slice(0, 8)}.zip`);
    try {
      execSync(`cd "${sessionTempDir}" && zip -r "${zipPath}" .`, { stdio: "pipe" });
    } catch (e) {
      return NextResponse.json(
        { error: "Failed to create ZIP file" },
        { status: 500 }
      );
    }

    // Read ZIP file
    const zipBuffer = fs.readFileSync(zipPath);

    // Cleanup temp directory
    try {
      execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" });
    } catch {}

    const safeName = (session.appName || "collector").replace(/\s+/g, "-").toLowerCase();

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}-${id.slice(0, 8)}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("ZIP download error:", error);
    return NextResponse.json(
      { error: "Failed to create download", details: error.message },
      { status: 500 }
    );
  }
}
