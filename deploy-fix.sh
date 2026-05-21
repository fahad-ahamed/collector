#!/bin/bash
# ============================================================
#  Collector - Deploy Script (Fully Dynamic)
#  Run this on the server: bash deploy-fix.sh
# ============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  Collector - Deploying Updates"
echo "=========================================="

cd "$PROJECT_DIR"

# Pull the latest code from GitHub
echo ""
echo "[1/4] Pulling latest code from GitHub..."
git pull origin main

# Create the "app session password" directory
mkdir -p "app session password"

# Create the master code file if it doesn't exist
if [ ! -f "app session password/master_code.txt" ]; then
    MASTER_CODE="${MASTER_CODE:-$(shuf -i 10000-99999 -n 1)}"
    echo "$MASTER_CODE" > "app session password/master_code.txt"
    echo "  Created master code file (code: $MASTER_CODE)"
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
pm2 restart all 2>/dev/null || pm2 start npm --name collector -- start

echo ""
echo "=========================================="
echo "  Deploy complete!"
echo "=========================================="

