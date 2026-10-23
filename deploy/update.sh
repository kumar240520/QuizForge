#!/bin/bash
set -e

APP_DIR="/home/ubuntu/QuizForge"
cd "$APP_DIR"

echo "--> Pulling latest code changes from Git..."
git checkout -- .
git pull

echo "--> Updating Python backend dependencies..."
"$APP_DIR/backend/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

echo "--> Rebuilding frontend static bundle..."
cd "$APP_DIR/frontend"
npm install
npm run build
cd "$APP_DIR"

echo "--> Restarting QuizForge backend service..."
sudo systemctl restart quizforge

echo "--> Reloading Nginx..."
sudo systemctl reload nginx

echo "✓ QuizForge updated successfully!"
