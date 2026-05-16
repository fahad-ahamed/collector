import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/collector-uploads";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.contactSession.findUnique({
      where: { id },
      include: { uploadedFiles: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const hasUploadedFiles = session.uploadedFiles.length > 0;

    // Create a temporary directory for the ZIP
    const zipId = randomUUID();
    const tempDir = path.join(tmpdir(), `zip-${zipId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create session folder structure in temp dir
    const sessionTempDir = path.join(tempDir, `collector-${id.slice(0, 8)}`);
    fs.mkdirSync(sessionTempDir, { recursive: true });

    let copiedCount = 0;

    // Copy uploaded files if they exist
    if (hasUploadedFiles) {
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
    }

    // Always export contacts as vCard
    try {
      const contacts = JSON.parse(session.contacts);
      if (Array.isArray(contacts) && contacts.length > 0) {
        const vcardContent = contacts.map((c: any) => {
          const esc = (s: string) => s
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/:/g, '\\:')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,');
          const lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${esc(c.name || '')}`,
            `N:${esc(c.name || '')};;;;`,
            `TEL;TYPE=CELL:${esc(c.phone || '')}`,
          ];
          if (c.email) lines.push(`EMAIL;TYPE=HOME:${esc(c.email)}`);
          if (c.organization) lines.push(`ORG:${esc(c.organization)}`);
          lines.push('END:VCARD');
          return lines.join('\n');
        }).join('\n\n');

        fs.writeFileSync(path.join(sessionTempDir, 'contacts.vcf'), vcardContent);
      }
    } catch (e) {
      // Skip vCard export if it fails
    }

    // Also export file metadata as JSON
    try {
      const files = JSON.parse(session.files);
      if (Array.isArray(files) && files.length > 0) {
        fs.writeFileSync(
          path.join(sessionTempDir, 'file-list.json'),
          JSON.stringify(files, null, 2)
        );
      }
    } catch (e) {
      // Skip
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
