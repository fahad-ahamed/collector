#!/bin/bash
# ============================================================
#  Collector - Full Setup Script (Fully Dynamic)
#  Installs all dependencies including Android SDK & JDK
#  Usage: bash install.sh
#  Works on ANY Ubuntu/Debian VPS automatically
# ============================================================

set -e

echo "=========================================="
echo "  Collector - Full Setup"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-$HOME}"
GITHUB_RELEASE="https://github.com/fahad-ahamed/collector/releases/download/v1.0.0-build-deps"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ============================================================
#  Auto-detect JAVA_HOME
# ============================================================
detect_java_home() {
    # 1. Check existing JAVA_HOME env
    if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/javac" ]; then
        echo "$JAVA_HOME"
        return
    fi
    # 2. Check system javac
    local sys_javac
    sys_javac=$(which javac 2>/dev/null || true)
    if [ -n "$sys_javac" ]; then
        # Derive JAVA_HOME from javac path
        echo "$(dirname "$(dirname "$sys_javac")")"
        return
    fi
    # 3. Check common JDK 21 locations
    for jdk_path in \
        /usr/lib/jvm/java-21-openjdk-amd64 \
        /usr/lib/jvm/java-21-openjdk-arm64 \
        /usr/lib/jvm/java-21-oracle \
        /usr/lib/jvm/default-java \
        "$INSTALL_DIR/jdk-21.0.2"; do
        if [ -x "$jdk_path/bin/javac" ]; then
            echo "$jdk_path"
            return
        fi
    done
    echo ""
}

# ============================================================
#  Auto-detect ANDROID_HOME
# ============================================================
detect_android_home() {
    # 1. Check existing ANDROID_HOME env
    if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME/build-tools" ]; then
        echo "$ANDROID_HOME"
        return
    fi
    # 2. Check common locations
    for sdk_path in \
        "$INSTALL_DIR/android-sdk" \
        /opt/android-sdk \
        /usr/lib/android-sdk \
        "$HOME/Android/Sdk"; do
        if [ -d "$sdk_path/build-tools" ]; then
            echo "$sdk_path"
            return
        fi
    done
    echo ""
}

# ============================================================
#  Step 1: Install system packages
# ============================================================
echo -e "\n${YELLOW}[1/6] Installing system packages...${NC}"
if command -v sudo &>/dev/null; then
    SUDO="sudo"
else
    SUDO=""
fi

$SUDO apt-get update -qq 2>/dev/null || true
$SUDO apt-get install -y -qq nodejs npm python3-pip curl nginx 2>/dev/null || {
    # Install Node.js 20 if not available
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
    $SUDO apt-get install -y python3-pip curl nginx
}
echo -e "${GREEN}System packages installed!${NC}"

# ============================================================
#  Step 2: Install Python dependencies
# ============================================================
echo -e "\n${YELLOW}[2/6] Installing Python dependencies...${NC}"
pip3 install --break-system-packages -r "$PROJECT_DIR/requirements.txt" 2>/dev/null || \
pip3 install -r "$PROJECT_DIR/requirements.txt" 2>/dev/null || \
pip install -r "$PROJECT_DIR/requirements.txt" 2>/dev/null || {
    $SUDO apt-get install -y python3-pip
    pip3 install --break-system-packages -r "$PROJECT_DIR/requirements.txt"
}
echo -e "${GREEN}Python dependencies installed!${NC}"

# ============================================================
#  Step 3: Install Node.js dependencies
# ============================================================
echo -e "\n${YELLOW}[3/6] Installing Node.js dependencies...${NC}"
cd "$PROJECT_DIR"
npm install
echo -e "${GREEN}Node dependencies installed!${NC}"

# ============================================================
#  Step 4: Install JDK 21 (only if not already present)
# ============================================================
echo -e "\n${YELLOW}[4/6] Installing JDK 21...${NC}"
DETECTED_JAVA_HOME=$(detect_java_home)

if [ -n "$DETECTED_JAVA_HOME" ]; then
    echo -e "${GREEN}JDK 21 already available at $DETECTED_JAVA_HOME${NC}"
    export JAVA_HOME="$DETECTED_JAVA_HOME"
else
    echo "No JDK found. Downloading JDK 21 (194MB)..."
    curl -L -o /tmp/jdk-21.0.2.tar.gz "$GITHUB_RELEASE/jdk-21.0.2.tar.gz"
    echo "Extracting JDK 21..."
    tar xzf /tmp/jdk-21.0.2.tar.gz -C "$INSTALL_DIR/"
    rm /tmp/jdk-21.0.2.tar.gz
    export JAVA_HOME="$INSTALL_DIR/jdk-21.0.2"
    echo -e "${GREEN}JDK 21 installed at $JAVA_HOME${NC}"
fi

export PATH="$JAVA_HOME/bin:$PATH"

# ============================================================
#  Step 5: Install Android SDK (only if not already present)
# ============================================================
echo -e "\n${YELLOW}[5/6] Installing Android SDK...${NC}"
DETECTED_ANDROID_HOME=$(detect_android_home)

if [ -n "$DETECTED_ANDROID_HOME" ]; then
    echo -e "${GREEN}Android SDK already available at $DETECTED_ANDROID_HOME${NC}"
    export ANDROID_HOME="$DETECTED_ANDROID_HOME"
else
    export ANDROID_HOME="${ANDROID_HOME:-$INSTALL_DIR/android-sdk}"
    mkdir -p "$ANDROID_HOME"

    # Download build-tools if not exists
    if [ ! -d "$ANDROID_HOME/build-tools/35.0.1" ]; then
        echo "Downloading Android build-tools 35.0.1 (58MB)..."
        curl -L -o /tmp/android-build-tools-35.0.1.tar.gz "$GITHUB_RELEASE/android-build-tools-35.0.1.tar.gz"
        echo "Extracting build-tools..."
        tar xzf /tmp/android-build-tools-35.0.1.tar.gz -C "$ANDROID_HOME/"
        rm /tmp/android-build-tools-35.0.1.tar.gz
        echo -e "${GREEN}build-tools 35.0.1 installed!${NC}"
    fi

    # Download platforms if not exists
    if [ ! -d "$ANDROID_HOME/platforms/android-35" ]; then
        echo "Downloading Android platforms android-35 (57MB)..."
        curl -L -o /tmp/android-platforms-35.tar.gz "$GITHUB_RELEASE/android-platforms-35.tar.gz"
        echo "Extracting platforms..."
        tar xzf /tmp/android-platforms-35.tar.gz -C "$ANDROID_HOME/"
        rm /tmp/android-platforms-35.tar.gz
        echo -e "${GREEN}platforms android-35 installed!${NC}"
    fi

    # Download licenses
    if [ ! -d "$ANDROID_HOME/licenses" ]; then
        echo "Downloading Android SDK licenses..."
        curl -L -o /tmp/android-licenses.tar.gz "$GITHUB_RELEASE/android-licenses.tar.gz"
        tar xzf /tmp/android-licenses.tar.gz -C "$ANDROID_HOME/"
        rm /tmp/android-licenses.tar.gz
    fi

    echo -e "${GREEN}Android SDK installed at $ANDROID_HOME${NC}"
fi

# Download debug keystore (project-relative path)
if [ ! -f "$PROJECT_DIR/android-app/build/keystore/debug.keystore" ]; then
    echo "Downloading debug keystore..."
    mkdir -p "$PROJECT_DIR/android-app/build/keystore/"
    curl -L -o "$PROJECT_DIR/android-app/build/keystore/debug.keystore" "$GITHUB_RELEASE/debug.keystore"
fi

# Save environment variables to .bashrc (only if not already there)
if ! grep -q "Collector build environment" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# Collector build environment" >> ~/.bashrc
    echo "export JAVA_HOME=$JAVA_HOME" >> ~/.bashrc
    echo "export ANDROID_HOME=$ANDROID_HOME" >> ~/.bashrc
    echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
fi

# Also save to project .env file for Next.js runtime
cat > "$PROJECT_DIR/.env" << ENVEOF
# Auto-generated by install.sh - $(date)
DATABASE_URL="file:./dev.db"
JAVA_HOME=$JAVA_HOME
ANDROID_HOME=$ANDROID_HOME
JAVAC_PATH=$JAVA_HOME/bin/javac
DB_DIR=./db
UPLOAD_DIR=/tmp/collector-uploads
SERVER_URL=
MASTER_CODE=
ENVEOF

echo -e "${GREEN}Environment saved to .env and .bashrc${NC}"

# ============================================================
#  Step 6: Build Next.js application
# ============================================================
echo -e "\n${YELLOW}[6/6] Building Next.js application...${NC}"
cd "$PROJECT_DIR"
npm run build
echo -e "${GREEN}Build complete!${NC}"

# ============================================================
#  Done!
# ============================================================
echo ""
echo -e "${GREEN}=========================================="
echo "  Collector setup complete!"
echo "==========================================${NC}"
echo ""
echo "Detected environment:"
echo "  JAVA_HOME=$JAVA_HOME"
echo "  ANDROID_HOME=$ANDROID_HOME"
echo "  Project dir: $PROJECT_DIR"
echo ""
echo "Run: bash run.sh"
echo "Or:  npm start"
echo ""
echo "For production, use PM2:"
echo "  pm2 start npm --name collector -- start"

