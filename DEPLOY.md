# Deployment Guide — Collector

Complete guide to deploy Collector on an AWS EC2 (Ubuntu) or any VPS.

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
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3 + pip
sudo apt-get install -y python3-pip

# Install Nginx
sudo apt-get install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt-get install -y git
```

---

## 3. Install Android SDK & JDK 21

### JDK 21

```bash
# Download JDK 21
cd /home/ubuntu
wget https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz
tar -xzf jdk-21_linux-x64_bin.tar.gz
rm jdk-21_linux-x64_bin.tar.gz

# Set JAVA_HOME
echo 'export JAVA_HOME=/home/ubuntu/jdk-21.0.2' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Android SDK

```bash
# Download command-line tools
cd /home/ubuntu
mkdir -p android-sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-*.zip
mv cmdline-tools android-sdk/cmdline-tools/latest
rm commandlinetools-linux-*.zip

# Accept licenses and install required packages
yes | android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
android-sdk/cmdline-tools/latest/bin/sdkmanager "platforms;android-35" "build-tools;35.0.1"

# Set ANDROID_HOME
echo 'export ANDROID_HOME=/home/ubuntu/android-sdk' >> ~/.bashrc
source ~/.bashrc
```

---

## 4. Clone & Install Collector

```bash
cd /home/ubuntu

# Clone repository
git clone https://github.com/fahad-ahamed/collector.git
cd collector

# Install all dependencies
bash install.sh
```

Or manually:

```bash
pip3 install -r requirements.txt
npm install
npm run build
```

---

## 5. Create Debug Keystore

```bash
# Only if android-app/build/keystore/ doesn't have one
mkdir -p android-app/build/keystore
keytool -genkey -v \
  -keystore android-app/build/keystore/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Debug, OU=Debug, O=Debug, L=Debug, ST=Debug, C=US"
```

---

## 6. Configure Environment

```bash
# Create .env file
cat > .env << 'EOF'
DB_DIR=./db
UPLOAD_DIR=/tmp/collector-uploads
EOF

# Create upload directory
mkdir -p /tmp/collector-uploads
```

---

## 7. Configure Nginx

```bash
# Remove default config
sudo rm /etc/nginx/sites-enabled/default

# Create Collector config
sudo tee /etc/nginx/sites-available/collector << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
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
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 600s;
        proxy_buffering off;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/collector /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 8. Start with PM2

```bash
# Start the application
cd /home/ubuntu/collector
pm2 start npm --name "collector" -- start

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup
```

---

## 9. Verify Deployment

```bash
# Check PM2 status
pm2 list

# Check application logs
pm2 logs collector

# Test API
curl http://localhost:3000/api/sessions

# Test from outside
curl http://your-server-ip/api/sessions
```

---

## 10. SSL (Optional - with Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
sudo certbot renew --dry-run
```

---

## Troubleshooting

### APK Build Fails

```bash
# Check Android SDK
echo $ANDROID_HOME
ls $ANDROID_HOME/platforms/android-35/
ls $ANDROID_HOME/build-tools/35.0.1/

# Check JDK
javac -version  # Should be javac 21.x

# Test manual build
curl -X POST http://localhost:3000/api/build-app \
  -F "appName=TestApp" \
  -o test.apk
```

### Services Won't Start

```bash
# Check logs
pm2 logs collector

# Rebuild
npm run build

# Restart
pm2 restart collector
```

### Nginx 502 Bad Gateway

```bash
# Check if Next.js is running
pm2 list

# Check Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Database Issues

```bash
# Check db directory
ls -la db/sessions/
ls -la db/files/

# Permissions
chmod -R 755 db/
```

---

## Updating

```bash
cd /home/ubuntu/collector

# Pull latest changes
git pull origin main

# Rebuild
npm install
npm run build

# Restart
pm2 restart collector
```

---

## Architecture Overview

```
Internet → Nginx (port 80) → Next.js (port 3000) → File DB (db/)
                                    ↓
                              APK Build Pipeline
                              (aapt2 → javac → d8 → apksigner)
                                    ↓
                              Android SDK + JDK 21
```

---

## Security Notes

- No authentication on the web dashboard — restrict access via firewall/VPN
- Debug keystore used for APK signing — generate a release keystore for production
- Data stored as plain JSON — consider encryption for sensitive data
- Nginx handles rate limiting and connection timeouts
- Android app uses cleartext HTTP — add SSL for production
