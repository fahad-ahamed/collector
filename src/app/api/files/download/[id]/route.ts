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

    let copiedFiles = 0;
    let skippedFiles = 0;

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
        // Skip files with empty or invalid serverPath
        if (!uploadedFile.serverPath || uploadedFile.serverPath.trim() === '') {
          skippedFiles++;
          continue;
        }

        // Prevent path traversal
        if (
          uploadedFile.serverPath.includes("..") ||
          path.isAbsolute(uploadedFile.serverPath)
        ) {
          skippedFiles++;
          continue;
        }

        const sourcePath = path.join(UPLOAD_DIR, uploadedFile.serverPath);
        if (fs.existsSync(sourcePath)) {
          const targetDir = typeDirs[uploadedFile.fileType] || typeDirs.other;
          const ext = path.extname(uploadedFile.fileName);
          const baseName = path.basename(uploadedFile.fileName, ext);

          // Create device subfolder if deviceId exists
          let destDir = targetDir;
          if (uploadedFile.deviceId && session.devices && session.devices[uploadedFile.deviceId]) {
            const deviceName = session.devices[uploadedFile.deviceId].name || uploadedFile.deviceId.slice(0, 8);
            destDir = path.join(targetDir, deviceName.replace(/[^a-zA-Z0-9\s\-_.]/g, ''));
            fs.mkdirSync(destDir, { recursive: true });
          }

          let targetPath = path.join(destDir, uploadedFile.fileName);
          let counter = 1;
          while (fs.existsSync(targetPath)) {
            targetPath = path.join(destDir, `${baseName}_${counter}${ext}`);
            counter++;
          }
          try {
            fs.copyFileSync(sourcePath, targetPath);
            copiedFiles++;
          } catch {
            skippedFiles++;
          }
        } else {
          skippedFiles++;
        }
      }
    }

    // Always export contacts as vCard
    try {
      const contacts = JSON.parse(session.contacts);
      if (Array.isArray(contacts) && contacts.length > 0) {
        // If multi-device, create per-device vCard files
        if (session.devices && Object.keys(session.devices).length > 1) {
          // Group contacts by deviceId
          const contactsByDevice: Record<string, any[]> = {};
          const noDeviceContacts: any[] = [];

          contacts.forEach((c: any) => {
            if (c.deviceId) {
              if (!contactsByDevice[c.deviceId]) contactsByDevice[c.deviceId] = [];
              contactsByDevice[c.deviceId].push(c);
            } else {
              noDeviceContacts.push(c);
            }
          });

          // Write per-device vCards
          for (const [deviceId, deviceContacts] of Object.entries(contactsByDevice)) {
            const deviceName = session.devices[deviceId]?.name || deviceId.slice(0, 8);
            const safeName = deviceName.replace(/[^a-zA-Z0-9\s\-_.]/g, '');
            const vcardContent = deviceContacts
              .map((c: Record<string, string>) => generateVCardEntry(c))
              .join("\n\n");
            fs.writeFileSync(
              path.join(sessionTempDir, `contacts_${safeName}.vcf`),
              vcardContent
            );
          }

          // Write contacts without deviceId
          if (noDeviceContacts.length > 0) {
            const vcardContent = noDeviceContacts
              .map((c: Record<string, string>) => generateVCardEntry(c))
              .join("\n\n");
            fs.writeFileSync(
              path.join(sessionTempDir, "contacts.vcf"),
              vcardContent
            );
          }
        } else {
          // Single device or no devices - write all contacts
          const vcardContent = contacts
            .map((c: Record<string, string>) => generateVCardEntry(c))
            .join("\n\n");
          fs.writeFileSync(
            path.join(sessionTempDir, "contacts.vcf"),
            vcardContent
          );
        }
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

    // Check if there's anything to zip
    const hasContent = fs.readdirSync(sessionTempDir).length > 0;
    if (!hasContent) {
      // Clean up and return error
      try { execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" }); } catch {}
      return NextResponse.json(
        { error: "No files available for download yet" },
        { status: 404 }
      );
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
      // Clean up
      try { execSync(`rm -rf "${tempDir}"`, { stdio: "pipe" }); } catch {}
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

function generateVCardEntry(c: Record<string, string>): string {
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
}
