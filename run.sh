#!/bin/bash
# ============================================================
#  Collector - Quick Start Script
#  Usage: bash run.sh
# ============================================================

set -e

echo "=========================================="
echo "  Collector - Setup & Run"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ============================================================
#  Step 1: Check Node.js
# ============================================================
echo -e "\n${YELLOW}[1/6] Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}Node.js found: $NODE_VERSION${NC}"
else
    echo -e "${RED}Node.js not found!${NC}"
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# ============================================================
#  Step 2: Install Python dependencies
# ============================================================
echo -e "\n${YELLOW}[2/6] Installing Python dependencies...${NC}"
pip install -r requirements.txt 2>/dev/null || pip3 install -r requirements.txt 2>/dev/null || {
    echo -e "${YELLOW}pip not found, installing Pillow...${NC}"
    sudo apt-get install -y python3-pip
    pip3 install -r requirements.txt
}
echo -e "${GREEN}Python dependencies installed!${NC}"

# ============================================================
#  Step 3: Install Node dependencies
# ============================================================
echo -e "\n${YELLOW}[3/6] Installing Node.js dependencies...${NC}"
npm install
echo -e "${GREEN}Node dependencies installed!${NC}"

# ============================================================
#  Step 4: Check Android SDK
# ============================================================
echo -e "\n${YELLOW}[4/6] Checking Android SDK...${NC}"
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${YELLOW}ANDROID_HOME not set.${NC}"
    echo "For APK building, install Android SDK and set ANDROID_HOME"
    echo "Download from: https://developer.android.com/studio#command-tools"
else
    echo -e "${GREEN}ANDROID_HOME: $ANDROID_HOME${NC}"
fi

# Check JDK
if command -v javac &> /dev/null; then
    JAVAC_VERSION=$(javac -version 2>&1)
    echo -e "${GREEN}JDK found: $JAVAC_VERSION${NC}"
else
    echo -e "${YELLOW}JDK not found. APK building requires JDK 21.${NC}"
fi

# ============================================================
#  Step 5: Build Next.js
# ============================================================
echo -e "\n${YELLOW}[5/6] Building Next.js application...${NC}"
npm run build
echo -e "${GREEN}Build complete!${NC}"

# ============================================================
#  Step 6: Start server
# ============================================================
echo -e "\n${YELLOW}[6/6] Starting server...${NC}"
echo ""
echo -e "${GREEN}=========================================="
echo "  Collector is running!"
echo "  URL: http://localhost:3000"
echo "==========================================${NC}"
echo ""
echo "Press Ctrl+C to stop."
echo ""

npm start
