#!/bin/bash
# ============================================================
#  Collector - Deploy Script
#  Run this on the EC2 server: bash deploy-fix.sh
# ============================================================

set -e

echo "=========================================="
echo "  Collector - Deploying Updates"
echo "=========================================="

cd /home/fahad/collector-final

# Pull the latest code from GitHub
echo ""
echo "[1/4] Pulling latest code from GitHub..."
git pull origin main

# Create the "app session password" directory
mkdir -p "app session password"

# Create the master code file if it doesn't exist
if [ ! -f "app session password/master_code.txt" ]; then
    echo "32423" > "app session password/master_code.txt"
    echo "  Created master code file"
fi

# Install dependencies (in case package.json changed)
echo ""
echo "[2/4] Installing dependencies..."
npm install --production=false

# Build the Next.js app
echo ""
echo "[3/4] Building Next.js..."
npm run build

# Restart the app
echo ""
echo "[4/4] Restarting server..."
pm2 restart all

echo ""
echo "=========================================="
echo "  Deploy complete!"
echo "  The master code 32423 is now hidden from the UI."
echo "=========================================="
