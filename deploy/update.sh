#!/bin/bash
set -e

APP_DIR="/home/ubuntu/QuizForge"
cd "$APP_DIR"

echo "--> Pulling latest code changes from Git..."
git checkout -- .
git pull

# 1. Ensure 2GB SWAP exists on 1GB EC2 instances (prevents Linux OOM "Killed" on micro instances)
if [ ! -f /swapfile ] && [ $(free -m | awk '/^Swap:/ {print $2}') -eq 0 ]; then
    echo "--> Configuring 2GB swap space for low-memory EC2 instance..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "--> Swap activated successfully."
fi

echo "--> Updating Python backend dependencies..."
"$APP_DIR/backend/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

# 2. Build frontend if needed, or use the pre-built dist from git
if [ -f "$APP_DIR/frontend/dist/index.html" ]; then
    echo "--> Pre-compiled frontend bundle is already present from git."
else
    echo "--> Building frontend with memory optimization..."
    cd "$APP_DIR/frontend"
    npm install --no-audit --no-fund
    NODE_OPTIONS="--max-old-space-size=1024" npm run build
    cd "$APP_DIR"
fi

echo "--> Setting frontend static file permissions..."
sudo chmod -R 755 "$APP_DIR/frontend/dist"

echo "--> Restarting QuizForge backend service..."
sudo systemctl restart quizforge

echo "--> Reloading Nginx..."
sudo systemctl reload nginx

echo "✓ QuizForge updated successfully!"
