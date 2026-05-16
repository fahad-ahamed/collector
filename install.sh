#!/bin/bash
# ============================================================
#  Collector - Requirements Installer
#  Installs all dependencies without running the app
#  Usage: bash install.sh
# ============================================================

set -e

echo "=========================================="
echo "  Collector - Installing Requirements"
echo "=========================================="

# Install Python dependencies
echo "[1/3] Installing Python dependencies..."
pip3 install -r requirements.txt 2>/dev/null || pip install -r requirements.txt 2>/dev/null || {
    echo "pip not found, installing..."
    sudo apt-get update
    sudo apt-get install -y python3-pip
    pip3 install -r requirements.txt
}
echo "Python dependencies installed!"

# Install Node dependencies
echo "[2/3] Installing Node.js dependencies..."
npm install
echo "Node dependencies installed!"

# Build
echo "[3/3] Building application..."
npm run build
echo "Build complete!"

echo ""
echo "All requirements installed! Run 'bash run.sh' or 'npm start' to start."
