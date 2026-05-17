#!/bin/bash
# Deploy script for fixing the 32423 master code visibility issue
# Run this on the EC2 server: bash deploy-fix.sh

cd /home/fahad/collector-final

# Pull the latest code from GitHub
git pull origin main

# Create the "app session password" directory
mkdir -p "app session password"

# Create the master code file if it doesn't exist
if [ ! -f "app session password/master_code.txt" ]; then
    echo "32423" > "app session password/master_code.txt"
fi

# Restart the Next.js app
pm2 restart all

echo "Deploy complete! The 32423 master code is now hidden from the UI."
