#!/bin/bash
# ============================================================
#  Collector - Quick Start Script (Fully Dynamic)
#  Auto-detects JAVA_HOME, ANDROID_HOME from system
#  Usage: bash run.sh
# ============================================================

set -e

echo "=========================================="
echo "  Collector - Starting"
echo "=========================================="

# Source bashrc for JAVA_HOME and ANDROID_HOME
source ~/.bashrc 2>/dev/null || true

# Auto-detect JAVA_HOME
if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
    # Try system javac
    if command -v javac &>/dev/null; then
        JAVA_HOME="$(dirname "$(dirname "$(which javac)")")"
    # Try common locations
    elif [ -x /usr/lib/jvm/java-21-openjdk-amd64/bin/javac ]; then
        JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
    elif [ -x /usr/lib/jvm/java-21-openjdk-arm64/bin/javac ]; then
        JAVA_HOME=/usr/lib/jvm/java-21-openjdk-arm64
    elif [ -x "$HOME/jdk-21.0.2/bin/javac" ]; then
        JAVA_HOME="$HOME/jdk-21.0.2"
    elif [ -x /usr/lib/jvm/default-java/bin/javac ]; then
        JAVA_HOME=/usr/lib/jvm/default-java
    fi
fi

# Auto-detect ANDROID_HOME
if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME/build-tools" ]; then
    if [ -d "$HOME/android-sdk/build-tools" ]; then
        ANDROID_HOME="$HOME/android-sdk"
    elif [ -d /opt/android-sdk/build-tools ]; then
        ANDROID_HOME=/opt/android-sdk
    elif [ -d "$HOME/Android/Sdk/build-tools" ]; then
        ANDROID_HOME="$HOME/Android/Sdk"
    fi
fi

export JAVA_HOME="${JAVA_HOME}"
export ANDROID_HOME="${ANDROID_HOME}"
export PATH="$JAVA_HOME/bin:$PATH"

echo "Environment:"
echo "  JAVA_HOME=$JAVA_HOME"
echo "  ANDROID_HOME=$ANDROID_HOME"

# Check if dependencies are installed
if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/javac" ] || [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME/build-tools/35.0.1" ]; then
    echo "Build dependencies not found. Running install.sh first..."
    bash "$(cd "$(dirname "$0")" && pwd)/install.sh"
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

