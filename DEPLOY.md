# Deployment Guide — Collector

Complete guide to deploy Collector on AWS EC2 (Ubuntu) or any VPS.

---

## Quick Deploy (One Command)

```bash
git clone https://github.com/fahad-ahamed/collector.git
cd collector
bash install.sh   # Downloads JDK, Android SDK, Node deps, builds everything
bash run.sh       # Starts the server
```

---

## 1. Server Setup

### Launch EC2 Instance

- **OS:** Ubuntu 22.04 LTS or 24.04 LTS
- **Instance Type:** t3.medium (2 vCPU, 4GB RAM) recommended
- **Storage:** 20GB+ GP3
- **Security Group:** Open port 22 (SSH) and 80 (HTTP)

### SSH into Server

```bash
ssh -i your-key.pem ubuntu@your-server-ip
```

---

## 2. Install System Dependencies

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git
```

---

## 3. Clone & Install

```bash
cd /home/ubuntu
git clone https://github.com/fahad-ahamed/collector.git
cd collector
bash install.sh
```

The `install.sh` script automatically:
- Installs Node.js 20, Python3, pip, Nginx
- Downloads JDK 21 from GitHub Release (194MB)
- Downloads Android SDK build-tools 35.0.1 from GitHub Release (58MB)
- Downloads Android SDK platforms android-35 from GitHub Release (57MB)
- Downloads debug keystore from GitHub Release
- Installs Python dependencies (Pillow)
- Installs Node.js dependencies
- Builds the Next.js application

---

## 4. Manual Build Dependencies Setup

If you prefer to set up manually instead of using `install.sh`:

### Download from GitHub Releases

```bash
GITHUB_RELEASE="https://github.com/fahad-ahamed/collector/releases/download/v1.0.0-build-deps"

# JDK 21
curl -L -o /tmp/jdk-21.0.2.tar.gz "$GITHUB_RELEASE/jdk-21.0.2.tar.gz"
tar xzf /tmp/jdk-21.0.2.tar.gz -C $HOME/
rm /tmp/jdk-21.0.2.tar.gz

# Android SDK build-tools
mkdir -p $HOME/android-sdk
curl -L -o /tmp/android-build-tools.tar.gz "$GITHUB_RELEASE/android-build-tools-35.0.1.tar.gz"
tar xzf /tmp/android-build-tools.tar.gz -C $HOME/android-sdk/
rm /tmp/android-build-tools.tar.gz

# Android SDK platforms
curl -L -o /tmp/android-platforms.tar.gz "$GITHUB_RELEASE/android-platforms-35.tar.gz"
tar xzf /tmp/android-platforms.tar.gz -C $HOME/android-sdk/
rm /tmp/android-platforms.tar.gz

# Android SDK licenses
curl -L -o /tmp/android-licenses.tar.gz "$GITHUB_RELEASE/android-licenses.tar.gz"
tar xzf /tmp/android-licenses.tar.gz -C $HOME/android-sdk/
rm /tmp/android-licenses.tar.gz

# Debug keystore
mkdir -p android-app/build/keystore/
curl -L -o android-app/build/keystore/debug.keystore "$GITHUB_RELEASE/debug.keystore"
```

### Set Environment Variables

```bash
echo 'export JAVA_HOME=$HOME/jdk-21.0.2' >> ~/.bashrc
echo 'export ANDROID_HOME=$HOME/android-sdk' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Verify

```bash
javac -version         # javac 21.0.2
$ANDROID_HOME/build-tools/35.0.1/aapt2 version   # Android Asset Packaging Tool
```

---

## 5. Configure Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/collector
sudo ln -s /etc/nginx/sites-available/collector /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. Start with PM2

```bash
cd /home/ubuntu/collector
pm2 start npm --name "collector" -- start
pm2 save
pm2 startup
```

---

## 7. Configure Environment

```bash
cat > .env << 'EOF'
DB_DIR=./db
UPLOAD_DIR=/tmp/collector-uploads
EOF

mkdir -p /tmp/collector-uploads
```

---

## Build Dependencies Summary

All build dependencies are available as GitHub Release assets:

| File | Size | Description |
|------|------|-------------|
| `jdk-21.0.2.tar.gz` | 194 MB | JDK 21.0.2 (javac, jar, keytool) |
| `android-build-tools-35.0.1.tar.gz` | 58 MB | aapt2, d8, apksigner, zipalign |
| `android-platforms-35.tar.gz` | 57 MB | android.jar, framework.aidl |
| `android-licenses.tar.gz` | <1 KB | Android SDK licenses |
| `debug.keystore` | 3 KB | Debug signing keystore |

**Total: ~308 MB**

Download URL format:
```
https://github.com/fahad-ahamed/collector/releases/download/v1.0.0-build-deps/{filename}
```

---

## Troubleshooting

### APK Build Fails

```bash
# Check environment
echo $JAVA_HOME
echo $ANDROID_HOME
javac -version
ls $ANDROID_HOME/build-tools/35.0.1/
ls $ANDROID_HOME/platforms/android-35/

# Test manual build
curl -X POST http://localhost:3000/api/build-app \
  -F "appName=TestApp" \
  -o test.apk
```

### Services Won't Start

```bash
pm2 logs collector
npm run build
pm2 restart collector
```

### Nginx 502 Bad Gateway

```bash
pm2 list
sudo nginx -t
sudo systemctl restart nginx
```

---

## Updating

```bash
cd /home/ubuntu/collector
git pull origin main
npm install
npm run build
pm2 restart collector
```

---

## Architecture

```
Internet → Nginx (port 80) → Next.js (port 3000) → File DB (db/)
                                    ↓
                              APK Build Pipeline
                              (aapt2 → javac → d8 → apksigner)
                                    ↓
                              Android SDK + JDK 21
```
