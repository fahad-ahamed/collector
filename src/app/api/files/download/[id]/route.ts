import { NextRequest, NextResponse } from "next/server";
import { findSessionById, findFilesBySessionId } from "@/lib/db";
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

    // Validate ID to prevent path traversal
    if (id.includes("..") || id.includes("/") || id.includes("\\")) {
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

    // Create a temporary directory for the ZIP
    const zipId = randomUUID();
    const tempDir = path.join(tmpdir(), `zip-${zipId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create session folder structure in temp dir
    const sessionTempDir = path.join(tempDir, `collector-${id.slice(0, 8)}`);
    fs.mkdirSync(sessionTempDir, { recursive: true });

    // Copy uploaded files if they exist
    if (uploadedFiles.length > 0) {
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

      for (const uploadedFile of uploadedFiles) {
        // Prevent path traversal
        if (
          uploadedFile.serverPath.includes("..") ||
          path.isAbsolute(uploadedFile.serverPath)
        ) {
          continue;
        }

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
          } catch {
            // Skip problematic files
          }
        }
      }
    }

    // Always export contacts as vCard
    try {
      const contacts = JSON.parse(session.contacts);
      if (Array.isArray(contacts) && contacts.length > 0) {
        const vcardContent = contacts
          .map((c: Record<string, string>) => {
            const esc = (s: string) =>
              s
                .replace(/\\/g, "\\\\")
                .replace(/;/g, "\\;")
                .replace(/:/g, "\\:")
                .replace(/\n/g, "\\n")
                .replace(/,/g, "\\,");
            const lines = [
              "BEGIN:VCARD",
              "VERSION:3.0",
              `FN:${esc(c.name || "")}`,
              `N:${esc(c.name || "")};;;;`,
              `TEL;TYPE=CELL:${esc(c.phone || "")}`,
            ];
            if (c.email) lines.push(`EMAIL;TYPE=HOME:${esc(c.email)}`);
            if (c.organization) lines.push(`ORG:${esc(c.organization)}`);
            lines.push("END:VCARD");
            return lines.join("\n");
          })
          .join("\n\n");

        fs.writeFileSync(
          path.join(sessionTempDir, "contacts.vcf"),
          vcardContent
        );
      }
    } catch {
      // Skip vCard export if it fails
    }

    // Also export file metadata as JSON
    try {
      const files = JSON.parse(session.files);
      if (Array.isArray(files) && files.length > 0) {
        fs.writeFileSync(
          path.join(sessionTempDir, "file-list.json"),
          JSON.stringify(files, null, 2)
        );
      }
    } catch {
      // Skip
    }

    // Create ZIP file
    const zipPath = path.join(
      tempDir,
      `collector-${id.slice(0, 8)}.zip`
    );
    try {
      execSync(`cd "${sessionTempDir}" && zip -r "${zipPath}" .`, {
        stdio: "pipe",
      });
    } catch {
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
    } catch {
      // Ignore cleanup errors
    }

    const safeName = (session.appName || "collector")
      .replace(/\s+/g, "-")
      .toLowerCase();

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}-${id.slice(0, 8)}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("ZIP download error:", message);
    return NextResponse.json(
      { error: "Failed to create download", details: message },
      { status: 500 }
    );
  }
}
