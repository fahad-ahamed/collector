#!/bin/bash
# ============================================================
#  Collector - Quick Start Script
#  Usage: bash run.sh
# ============================================================

set -e

echo "=========================================="
echo "  Collector - Starting"
echo "=========================================="

# Source bashrc for JAVA_HOME and ANDROID_HOME
source ~/.bashrc 2>/dev/null || true

# Set defaults if not set
export JAVA_HOME="${JAVA_HOME:-$HOME/jdk-21.0.2}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

# Check if dependencies are installed
if [ ! -d "$JAVA_HOME" ] || [ ! -d "$ANDROID_HOME/build-tools/35.0.1" ]; then
    echo "Build dependencies not found. Running install.sh first..."
    bash install.sh
fi

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Check if .next build exists
if [ ! -d ".next" ]; then
    echo "Building Next.js..."
    npm run build
fi

echo ""
echo "Starting Collector on http://localhost:3000"
echo "Press Ctrl+C to stop."
echo ""

npm start
