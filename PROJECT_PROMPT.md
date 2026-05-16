# Collector — Full Project Rebuild Prompt

Use the following prompt to recreate the entire Collector project from scratch using an AI coding assistant (e.g., Claude, GPT, Cursor, etc.):

---

## Prompt

Build a full-stack web application called **"Collector"** — a remote device data collection platform with a custom Android APK builder. The web dashboard allows an operator to build a custom-named Android app, install it on target devices, and remotely collect all contacts and files in real-time.

### Core Architecture

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Frontend:** React 19, Tailwind CSS 4, shadcn/ui (new-york style), Lucide React icons
- **Database:** File-based JSON storage (no SQL/ORM) — each session and file metadata stored as individual JSON files in a `db/` directory
- **Deployment:** Vercel-compatible with extended function durations

### Feature 1: Custom APK Builder (Server-Side)

Create a `POST /api/build-app` endpoint that:

1. Accepts `appName` (string) and `logo` (image file) from a form
2. Copies a template Android project from `android-app/` to a temp directory
3. Injects the app name into `strings.xml` and `AndroidManifest.xml`
4. Injects the server's base URL as `WEBSITE_BASE_URL` into `MainActivity.java`
5. Generates a unique `BUILD_ID` and injects it into `MainActivity.java`
6. Copies the custom logo as `ic_launcher.png` into all mipmap directories
7. Builds the APK using command-line tools in sequence:
   - `aapt2 compile` — compile resources
   - `aapt2 link` — link resources
   - `javac` (JDK 21) — compile Java source to class files
   - `d8` — convert class files to DEX
   - `zip` — package into APK
   - `zipalign` — align the APK
   - `apksigner` — sign with debug keystore
8. Returns the signed APK as a downloadable binary response
9. Creates a session record in the database with status `apk_built`

The Android template project should be a minimal app with:
- Package name: `com.contactcollector.app`
- Target SDK 34, minSdk 24
- Three Java files: `MainActivity.java`, `HeartbeatService.java`, `FileUploadService.java`

### Feature 2: Android App (Java)

**MainActivity.java:**
- On launch, shows a permission request screen for `READ_CONTACTS` and `MANAGE_EXTERNAL_STORAGE`
- After permissions granted, reads ALL contacts using `ContactsContract` (name, phone, email, organization)
- Scans key directories for file metadata: Download, DCIM, Pictures, Documents, Music, Movies, Recordings, WhatsApp
- Uploads contacts + file metadata as JSON to `POST /api/contacts/upload` with retry logic (3 attempts, exponential backoff)
- Generates a unique `deviceId` from `Build.BRAND_Model_timestamp_random`
- Sends `buildId` with all uploads for session matching
- After upload, starts `FileUploadService` and `HeartbeatService` as foreground services
- Hides app icon from launcher using `PackageManager.COMPONENT_ENABLED_STATE_DISABLED`
- Uses raw `HttpURLConnection` for all HTTP requests (no external libraries)

**HeartbeatService.java:**
- Foreground service with persistent notification
- Sends heartbeat to `POST /api/heartbeat` every 30 seconds
- Includes device info: brand, model, Android version, deviceId
- Survives app being swiped away

**FileUploadService.java:**
- Foreground service that continuously uploads files from device directories
- Priority directories: DCIM/Camera, Screenshots, WhatsApp Images/Video/Documents/Audio, Download, Pictures, Documents
- Uploads files via multipart POST to `POST /api/files/upload` (max 50MB per file)
- Tracks uploaded files in SharedPreferences to avoid re-uploads
- 200ms delay between uploads to avoid overwhelming the server

### Feature 3: Web Dashboard — Home Page

Create `app/page.tsx` as the main dashboard:

- **APK Builder Form:** Input for app name, file upload for logo, "Build App" button
- **Sessions List:** Cards showing each session with:
  - App name and creation date
  - Contact count and file count
  - Device count with online/offline indicators
  - Live status badge (apk_built, waiting_install, permissions_granted, uploading, live_connected)
  - Click to navigate to session detail view
- **Auto-refresh** every 10 seconds
- **Delete session** button on each card

### Feature 4: Session Detail View

Create `app/view/[id]/page.tsx` with three tabs:

**Contacts Tab:**
- Display all contacts in a searchable, filterable list
- Show contact name, phone, email, organization, and originating device
- Search by name, phone, or email
- Filter by device
- For each contact: vCard preview, copy vCard, download vCard (.vcf), share vCard
- "Download All vCard" button for bulk export
- "Sync Contacts" button to trigger re-sync from the device
- Generate v3.0 vCards with proper formatting

**Files Tab:**
- Display all uploaded files in list or grid view
- File type icons (image, video, audio, pdf, document, apk, vcf, archive, folder)
- File type filter buttons
- Search by file name
- Filter by device
- For each file: preview, download, delete options
- "Download All as ZIP" button that creates a ZIP organized by type (Images/, Videos/, Audio/, Documents/, Other/) with per-device subfolders and includes contacts as vCard
- Auto-refresh every 5 seconds

**Manager Tab (File Manager):**
- Directory tree browsing via `GET /api/files/browse?sessionId=&path=&deviceId=`
- Breadcrumb navigation for current path
- Device selector dropdown
- File type icons and size display
- Click folders to navigate, click files to preview/download
- Delete files from the manager
- List/Grid view toggle

### Feature 5: Multi-Device Support

- Each APK build has a unique `buildId`
- Each device generates a unique `deviceId`
- On contact/file upload, if `buildId` matches an existing session, data is merged:
  - Old data from the same `deviceId` is replaced
  - New data from different devices is appended
- Device info is registered/updated on heartbeat and upload via a `registerOrUpdateDevice()` function
- Web dashboard shows a device selector with:
  - Device name, model, brand
  - Android version
  - Online/offline status (online = heartbeat within 60 seconds)
  - Contact count and file count per device
  - First seen timestamp
- All contacts and files are tagged with the originating `deviceId`
- ZIP downloads organize files into per-device subfolders

### Feature 6: Live Status & Online/Offline Detection

- Session status tracks: `apk_built` → `waiting_install` → `permissions_granted` → `uploading` → `live_connected`
- Android app sends status updates to `POST /api/status/update`
- Heartbeat updates `lastHeartbeat` timestamp
- A device is considered **online** if `lastHeartbeat` is within the last 60 seconds
- The dashboard shows green "Online" or gray "Offline" badges
- Auto-polling refreshes the status every 5-10 seconds

### API Endpoints Summary

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/build-app` | Build custom APK |
| `GET` | `/api/sessions` | List all sessions |
| `DELETE` | `/api/sessions` | Delete a session |
| `GET` | `/api/sessions/[id]/status` | Get session status + devices |
| `POST` | `/api/contacts/upload` | Upload contacts + file metadata |
| `GET` | `/api/contacts/view/[id]` | Get full session data |
| `POST` | `/api/contacts/sync` | Trigger re-sync |
| `POST` | `/api/files/upload` | Upload file (multipart, max 100MB) |
| `GET` | `/api/files/download/[id]` | Download all as ZIP |
| `GET` | `/api/files/browse` | Directory browsing |
| `DELETE` | `/api/files/delete` | Delete a file |
| `GET` | `/api/files/file/[fileId]` | Stream single file |
| `POST` | `/api/heartbeat` | Device heartbeat |
| `POST` | `/api/status/update` | Update session status |

### Data Model

**Session:** `{ id, contacts (JSON string), files (JSON string), appName, count, fileCount, createdAt, status, statusHistory, lastHeartbeat, buildId, devices (Record<string, DeviceInfo>) }`

**DeviceInfo:** `{ id, name, model, brand, androidVersion, lastHeartbeat, firstSeen }`

**Contact:** `{ id, name, phone, email?, organization?, deviceId? }`

**UploadedFile:** `{ id, sessionId, deviceId?, filePath, fileName, fileSize, fileType, serverPath, uploadedAt }`

### Database Implementation

Create `lib/db.ts` with:
- `DB_DIR` environment variable (default: `db/`)
- `UPLOAD_DIR` environment variable (default: `/tmp/collector-uploads`)
- Functions: `getSession()`, `createSession()`, `updateSession()`, `deleteSession()`, `listSessions()`, `getFileRecord()`, `createFileRecord()`, `deleteFileRecord()`, `listSessionFiles()`, `registerOrUpdateDevice()`
- Each session stored as `{id}.json` in `db/sessions/`
- Each file record stored as `{id}.json` in `db/files/`
- Physical uploaded files stored in `UPLOAD_DIR/{sessionId}/{uuid}.{ext}`

### Vercel Configuration

Include `vercel.json`:
```json
{
  "functions": {
    "app/api/build-app/route.ts": { "maxDuration": 120 },
    "app/api/files/download/[id]/route.ts": { "maxDuration": 120 },
    "app/api/files/upload/route.ts": { "maxDuration": 60 }
  }
}
```

### UI Design

- Clean, modern dark/light theme using shadcn/ui components
- Cards with rounded corners, subtle borders, and hover effects
- Status badges with color coding (green for online, gray for offline, blue for active)
- File type icons using Lucide React (Image, Video, Music, FileText, File, Archive, etc.)
- Responsive layout that works on desktop and mobile
- Toast notifications for actions (build started, download complete, file deleted, etc.)
- Loading states and skeleton screens

### Android Build Requirements

- Android SDK at `ANDROID_HOME` with `platforms/android-34` and `build-tools/34.0.0`
- JDK 21 at a configurable path
- Debug keystore at `android-app/build/keystore/debug.keystore`
- All build steps executed via `child_process.execSync()` or `execFile()`

### Important Constraints

- No authentication on the dashboard (session URL = full access)
- Debug-signed APK only (not Play Store ready)
- File upload limit: 100MB server-side, 50MB Android client
- Contact limit: 50,000 per session
- File metadata limit: 100,000 per session
- No external Android libraries (raw HttpURLConnection only)
- No encryption on stored data

---

This prompt describes a complete, production-structure project. When fed into an AI coding assistant with access to Next.js 16, Android SDK, and JDK 21 toolchains, it should produce a fully functional Collector application.
