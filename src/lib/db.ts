import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// ─── File-Based JSON Database ────────────────────────────
// Uses the /db folder as the database, storing each session as a JSON file.
// No Prisma, no SQLite, no auth needed.

const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), "db");
const SESSIONS_DIR = path.join(DB_DIR, "sessions");
const FILES_DIR = path.join(DB_DIR, "files");

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
}

ensureDirs();

// ─── Types ──────────────────────────────────────────────

export interface ContactSession {
  id: string;
  contacts: string; // JSON array of contacts
  files: string; // JSON array of file metadata
  appName: string;
  count: number;
  fileCount: number;
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  sessionId: string;
  filePath: string; // Original path on phone
  fileName: string;
  fileSize: number;
  fileType: string;
  serverPath: string; // Relative path on server filesystem
  uploadedAt: string;
}

// ─── Session Operations ─────────────────────────────────

export async function createSession(data: {
  contacts: string;
  files: string;
  appName: string;
  count: number;
  fileCount: number;
}): Promise<ContactSession> {
  ensureDirs();
  const id = randomUUID();
  const session: ContactSession = {
    id,
    contacts: data.contacts,
    files: data.files,
    appName: data.appName,
    count: data.count,
    fileCount: data.fileCount,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(SESSIONS_DIR, `${id}.json`),
    JSON.stringify(session, null, 2)
  );
  return session;
}

export async function findSessionById(
  id: string
): Promise<ContactSession | null> {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ContactSession;
  } catch {
    return null;
  }
}

export async function deleteSessionById(id: string): Promise<boolean> {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    // Also delete associated file records
    const files = await findFilesBySessionId(id);
    for (const f of files) {
      const fp = path.join(FILES_DIR, `${f.id}.json`);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Uploaded File Operations ───────────────────────────

export async function createUploadedFile(data: {
  sessionId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  serverPath: string;
}): Promise<UploadedFile> {
  ensureDirs();
  const id = randomUUID();
  const uploadedFile: UploadedFile = {
    id,
    sessionId: data.sessionId,
    filePath: data.filePath,
    fileName: data.fileName,
    fileSize: data.fileSize,
    fileType: data.fileType,
    serverPath: data.serverPath,
    uploadedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(FILES_DIR, `${id}.json`),
    JSON.stringify(uploadedFile, null, 2)
  );
  return uploadedFile;
}

export async function findFileById(
  id: string
): Promise<UploadedFile | null> {
  ensureDirs();
  const filePath = path.join(FILES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as UploadedFile;
  } catch {
    return null;
  }
}

export async function findFilesBySessionId(
  sessionId: string
): Promise<UploadedFile[]> {
  ensureDirs();
  const files: UploadedFile[] = [];
  try {
    const entries = fs.readdirSync(FILES_DIR);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(FILES_DIR, entry), "utf-8");
        const parsed = JSON.parse(raw) as UploadedFile;
        if (parsed.sessionId === sessionId) {
          files.push(parsed);
        }
      } catch {
        // Skip corrupt files
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return files;
}
