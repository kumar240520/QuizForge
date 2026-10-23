#!/bin/bash
set -e

echo "=================================================="
echo "    QuizForge Automated EC2 Setup (Ubuntu LTS)    "
echo "=================================================="

# 1. Update OS packages
echo "--> Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install essential dependencies (Python, Nginx, Git, build tools)
echo "--> Installing Python 3, venv, pip, Nginx, and build-essential..."
sudo apt install -y python3 python3-venv python3-pip nginx git curl build-essential

# 3. Install Node.js 20 LTS (NodeSource)
if ! command -v node &> /dev/null; then
    echo "--> Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "--> Node.js already installed: $(node -v)"
fi

APP_DIR="/home/ubuntu/QuizForge"

if [ ! -d "$APP_DIR" ]; then
    echo "Error: Directory $APP_DIR not found. Please ensure the repository is cloned into /home/ubuntu/QuizForge"
    exit 1
fi

cd "$APP_DIR"

# 4. Set up Backend Python Virtual Environment
echo "--> Setting up Python virtual environment..."
if [ ! -d "$APP_DIR/backend/venv" ]; then
    python3 -m venv "$APP_DIR/backend/venv"
fi

"$APP_DIR/backend/venv/bin/pip" install --upgrade pip
"$APP_DIR/backend/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

# 5. Build Frontend React/Vite Application
echo "--> Installing frontend dependencies and compiling static bundle..."
cd "$APP_DIR/frontend"
rm -f package-lock.json
npm install
npm run build
cd "$APP_DIR"

# 6. Configure Systemd Service for FastAPI
echo "--> Configuring quizforge.service systemd daemon..."
sudo cp "$APP_DIR/deploy/quizforge.service" /etc/systemd/system/quizforge.service
sudo systemctl daemon-reload
sudo systemctl enable quizforge
sudo systemctl restart quizforge

# 7. Configure Nginx Reverse Proxy
echo "--> Configuring Nginx reverse proxy..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/quizforge
sudo ln -sf /etc/nginx/sites-available/quizforge /etc/nginx/sites-enabled/quizforge
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax and restart
sudo nginx -t
sudo systemctl restart nginx

# 8. Finished!
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || echo "your-ec2-public-ip")

echo "=================================================="
echo "  ✓ QuizForge Successfully Deployed on AWS EC2!   "
echo "=================================================="
echo "You can now open your browser and navigate to:"
echo "http://$PUBLIC_IP"
echo ""
echo "To check backend status:  sudo systemctl status quizforge"
echo "To view backend logs:     sudo journalctl -u quizforge -f"
echo "To reload Nginx:          sudo systemctl reload nginx"
echo "=================================================="
