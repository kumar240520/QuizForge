# Step-by-Step Guide: Deploying QuizForge on AWS EC2 (Single Instance)

This guide takes you through the entire process of hosting **QuizForge** (Frontend + Backend + SQLite Database) on a single **Amazon EC2** Ubuntu instance.

---

## 📌 What You Will Get
- **Vite/React Frontend**: Compiled and served at maximum speed via Nginx.
- **FastAPI Python Backend**: Running 24/7 as an automated `systemd` background service.
- **SQLite Database**: Stored safely on persistent AWS EBS SSD storage (`quizforge.db`).
- **Nginx Reverse Proxy**: Directs web traffic, handles compression, and provides SSL/HTTPS.
- **Cost**: **$0.00 / Free** for 12 months under the AWS Free Tier.

---

## Step 1: Launch Your EC2 Instance on AWS

1. Log into your [AWS Management Console](https://console.aws.amazon.com/ec2).
2. Go to **EC2** ➔ Click the orange **"Launch Instance"** button.
3. Configure the instance settings:
   - **Name**: `QuizForge-Server`
   - **OS (AMI)**: **Ubuntu Server 24.04 LTS** (or 22.04 LTS), 64-bit (x86).
   - **Instance Type**: 
     - Choose **`t2.micro`** or **`t3.micro`** (Eligible for AWS Free Tier).
     - *(Optional: If you selected ARM architecture, choose `t4g.small`)*.
   - **Key Pair**: 
     - Click **"Create new key pair"** (e.g., `quizforge-key`), choose `.pem`, and download it to your computer.
   - **Network & Firewall (Security Groups)**:
     - Check ✅ **Allow SSH traffic from** (Anywhere or My IP)
     - Check ✅ **Allow HTTP traffic from the internet** (Port 80)
     - Check ✅ **Allow HTTPS traffic from the internet** (Port 443)
   - **Configure Storage**:
     - Change storage size from 8 GB to **20 GB** (AWS Free Tier allows up to 30 GB of gp3 SSD for free).
4. Click **"Launch Instance"**.
5. Wait ~30 seconds until the status shows **Running**. Copy your instance's **Public IPv4 address** (e.g., `3.85.120.45`).

---

## Step 2: Connect to Your EC2 Instance

You have two easy ways to connect:

### Method A: Browser Connect (No SSH client required)
1. In the AWS EC2 Console, select your instance and click the **"Connect"** button at the top.
2. Under the **EC2 Instance Connect** tab, click **"Connect"**.
3. A terminal window will open in your web browser.

### Method B: Terminal (from your PC)
On Windows (PowerShell) or Mac/Linux:
```bash
chmod 400 quizforge-key.pem   # Mac/Linux only
ssh -i "path/to/quizforge-key.pem" ubuntu@YOUR-EC2-PUBLIC-IP
```

---

## Step 3: Clone QuizForge & Set Environment Variables

Once inside your EC2 terminal:

1. Clone your repository into `/home/ubuntu/QuizForge`:
   ```bash
   git clone <YOUR-GITHUB-REPO-URL> QuizForge
   cd QuizForge
   ```

2. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   nano .env
   ```

3. Paste your production variables (use arrow keys to edit, then `Ctrl+O` to save, `Ctrl+X` to exit):
   ```env
   APP_NAME="QuizForge"
   DATABASE_URL="sqlite:///./quizforge.db"
   SECRET_KEY="replace-with-a-random-long-secret-key"
   JWT_SECRET_KEY="replace-with-another-random-long-secret-key"
   MASTER_ADMIN_TOTP_SECRET="JBSWY3DPEHPK3PXP"
   GEMINI_API_KEY=""
   GEMINI_MODEL="gemini-2.5-flash"
   ```

---

## Step 4: Run the One-Click Automated Setup

We have included an automated script that installs Python, Node.js, Nginx, builds the frontend, and starts the background service:

```bash
# Make the deployment scripts executable
chmod +x deploy/setup-ec2.sh deploy/update.sh

# Run the automated setup
./deploy/setup-ec2.sh
```

### What This Script Does Automatically:
1. Installs Python 3, venv, pip, Node.js 20 LTS, and Nginx.
2. Creates the Python virtual environment and installs all dependencies.
3. Builds the production frontend bundle into `frontend/dist`.
4. Installs and starts the `quizforge.service` systemd daemon so FastAPI runs 24/7.
5. Configures Nginx reverse proxy on port 80.

---

## Step 5: Test in Your Browser!

Open your web browser and navigate to:
```
http://YOUR-EC2-PUBLIC-IP
```
QuizForge will load instantly! You can register your owner admin account using your Google Authenticator 2FA key.

---

## Step 6: (Optional) Add Your Custom Domain & Free SSL (HTTPS)

If you have a domain name (e.g., `quizforge.yourdomain.com`):

1. **Point your Domain**:
   In your domain registrar (GoDaddy, Namecheap, Cloudflare, Route 53):
   - Add an **A Record**:
     - **Host**: `@` (or `quiz`)
     - **Value**: `YOUR-EC2-PUBLIC-IP`
2. **Install Free SSL via Certbot**:
   Run these two commands on your EC2 terminal:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```
   Follow the prompt (enter your email and agree). Certbot will automatically configure SSL, update Nginx, and schedule auto-renewals!

---

## 🛠️ Helpful Commands for Day-to-Day Maintenance

### How to Update QuizForge Later
Whenever you push code updates to GitHub:
```bash
cd /home/ubuntu/QuizForge
./deploy/update.sh
```
This automatically pulls the latest code, rebuilds the frontend, and restarts the service with 0 hassle.

### Checking Backend Service Status
```bash
sudo systemctl status quizforge
```

### Viewing Live Server Logs
```bash
sudo journalctl -u quizforge -f
```

### Restarting the Services
```bash
sudo systemctl restart quizforge
sudo systemctl restart nginx
```

### 1-Click Backups
In the AWS Console ➔ Go to **EC2 ➔ Volumes** ➔ Right-click your volume ➔ Click **"Create Snapshot"**. This creates a complete image backup of your entire server and database in seconds.
