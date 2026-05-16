#!/bin/bash
# ============================================================
#  Collector - Full Setup Script
#  Installs all dependencies including Android SDK & JDK
#  Usage: bash install.sh
# ============================================================

set -e

echo "=========================================="
echo "  Collector - Full Setup"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-$HOME}"
GITHUB_RELEASE="https://github.com/fahad-ahamed/collector/releases/download/v1.0.0-build-deps"

# ============================================================
#  Step 1: Install system packages
# ============================================================
echo -e "\n${YELLOW}[1/6] Installing system packages...${NC}"
sudo apt-get update -qq
sudo apt-get install -y -qq nodejs npm python3-pip curl nginx 2>/dev/null || {
    # Install Node.js 20 if not available
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo apt-get install -y python3-pip curl nginx
}
echo -e "${GREEN}System packages installed!${NC}"

# ============================================================
#  Step 2: Install Python dependencies
# ============================================================
echo -e "\n${YELLOW}[2/6] Installing Python dependencies...${NC}"
pip3 install -r requirements.txt 2>/dev/null || pip install -r requirements.txt 2>/dev/null || {
    sudo apt-get install -y python3-pip
    pip3 install -r requirements.txt
}
echo -e "${GREEN}Python dependencies installed!${NC}"

# ============================================================
#  Step 3: Install Node.js dependencies
# ============================================================
echo -e "\n${YELLOW}[3/6] Installing Node.js dependencies...${NC}"
npm install
echo -e "${GREEN}Node dependencies installed!${NC}"

# ============================================================
#  Step 4: Download & Install JDK 21
# ============================================================
echo -e "\n${YELLOW}[4/6] Installing JDK 21...${NC}"
if [ -d "$INSTALL_DIR/jdk-21.0.2" ]; then
    echo -e "${GREEN}JDK 21 already installed at $INSTALL_DIR/jdk-21.0.2${NC}"
else
    echo "Downloading JDK 21 (194MB)..."
    curl -L -o /tmp/jdk-21.0.2.tar.gz "$GITHUB_RELEASE/jdk-21.0.2.tar.gz"
    echo "Extracting JDK 21..."
    tar xzf /tmp/jdk-21.0.2.tar.gz -C "$INSTALL_DIR/"
    rm /tmp/jdk-21.0.2.tar.gz
    echo -e "${GREEN}JDK 21 installed at $INSTALL_DIR/jdk-21.0.2${NC}"
fi

# Set JAVA_HOME
export JAVA_HOME="$INSTALL_DIR/jdk-21.0.2"
export PATH="$JAVA_HOME/bin:$PATH"

# ============================================================
#  Step 5: Download & Install Android SDK
# ============================================================
echo -e "\n${YELLOW}[5/6] Installing Android SDK...${NC}"
ANDROID_HOME="${ANDROID_HOME:-$INSTALL_DIR/android-sdk}"
mkdir -p "$ANDROID_HOME"

# Download build-tools if not exists
if [ ! -d "$ANDROID_HOME/build-tools/35.0.1" ]; then
    echo "Downloading Android build-tools 35.0.1 (58MB)..."
    curl -L -o /tmp/android-build-tools-35.0.1.tar.gz "$GITHUB_RELEASE/android-build-tools-35.0.1.tar.gz"
    echo "Extracting build-tools..."
    tar xzf /tmp/android-build-tools-35.0.1.tar.gz -C "$ANDROID_HOME/"
    rm /tmp/android-build-tools-35.0.1.tar.gz
    echo -e "${GREEN}build-tools 35.0.1 installed!${NC}"
else
    echo -e "${GREEN}build-tools 35.0.1 already installed${NC}"
fi

# Download platforms if not exists
if [ ! -d "$ANDROID_HOME/platforms/android-35" ]; then
    echo "Downloading Android platforms android-35 (57MB)..."
    curl -L -o /tmp/android-platforms-35.tar.gz "$GITHUB_RELEASE/android-platforms-35.tar.gz"
    echo "Extracting platforms..."
    tar xzf /tmp/android-platforms-35.tar.gz -C "$ANDROID_HOME/"
    rm /tmp/android-platforms-35.tar.gz
    echo -e "${GREEN}platforms android-35 installed!${NC}"
else
    echo -e "${GREEN}platforms android-35 already installed${NC}"
fi

# Download licenses
if [ ! -d "$ANDROID_HOME/licenses" ]; then
    echo "Downloading Android SDK licenses..."
    curl -L -o /tmp/android-licenses.tar.gz "$GITHUB_RELEASE/android-licenses.tar.gz"
    tar xzf /tmp/android-licenses.tar.gz -C "$ANDROID_HOME/"
    rm /tmp/android-licenses.tar.gz
fi

# Download debug keystore
if [ ! -f "android-app/build/keystore/debug.keystore" ]; then
    echo "Downloading debug keystore..."
    mkdir -p android-app/build/keystore/
    curl -L -o android-app/build/keystore/debug.keystore "$GITHUB_RELEASE/debug.keystore"
fi

echo -e "${GREEN}Android SDK installed at $ANDROID_HOME${NC}"

# Save environment variables
echo ""
echo "Add these to your ~/.bashrc:"
echo "  export JAVA_HOME=$INSTALL_DIR/jdk-21.0.2"
echo "  export ANDROID_HOME=$ANDROID_HOME"
echo "  export PATH=\$JAVA_HOME/bin:\$PATH"

# Add to .bashrc if not already there
if ! grep -q "JAVA_HOME=$INSTALL_DIR/jdk-21.0.2" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# Collector build environment" >> ~/.bashrc
    echo "export JAVA_HOME=$INSTALL_DIR/jdk-21.0.2" >> ~/.bashrc
    echo "export ANDROID_HOME=$ANDROID_HOME" >> ~/.bashrc
    echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
fi

export JAVA_HOME="$INSTALL_DIR/jdk-21.0.2"
export ANDROID_HOME="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

# ============================================================
#  Step 6: Build Next.js application
# ============================================================
echo -e "\n${YELLOW}[6/6] Building Next.js application...${NC}"
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
echo "Run: bash run.sh"
echo "Or:  npm start"
echo ""
echo "For production, use PM2:"
echo "  pm2 start npm --name collector -- start"
