# Deploying QuizForge on Vercel

This guide explains how to deploy QuizForge (both the React/Vite Frontend and the FastAPI Python Backend) to **Vercel** with zero-configuration setup.

---

## 🏗️ Architecture on Vercel

QuizForge is configured as a **monorepo fullstack application** on Vercel:

1. **Frontend (Vite + React SPA)**:
   - Output directory: `frontend/dist`
   - Handled directly by Vercel's global Edge CDN with sub-second asset delivery and client-side routing.
2. **Backend (FastAPI Serverless Functions)**:
   - Entry point: `api/index.py`
   - Built with `@vercel/python` serverless runtime.
3. **Routing (`vercel.json`)**:
   - `/api/(.*)` ➔ Routed automatically to `api/index.py` (FastAPI backend).
   - `/(.*)` ➔ Routed to `index.html` (React Router SPA).

---

## 🚀 Quick Deployment Options

### Option 1: GitHub / GitLab / Bitbucket (Recommended)

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Configure Vercel fullstack deployment"
   git push origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new) and click **"Import"** on your repository.
3. **Project Settings**:
   - **Framework Preset**: Other (or Vite)
   - **Root Directory**: `./` (leave as root)
   - **Build Command**: `npm run build` (configured automatically via `vercel.json`)
   - **Output Directory**: `frontend/dist` (configured automatically via `vercel.json`)
4. Add your **Environment Variables** (see below).
5. Click **Deploy**!

---

### Option 2: Deploying via Vercel CLI

1. Install the Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
2. Log in and deploy from the root directory:
   ```bash
   vercel
   ```
3. To deploy to production:
   ```bash
   vercel --prod
   ```

---

## 🔑 Environment Variables

Configure these in your **Vercel Project Settings ➔ Environment Variables**:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `MASTER_ADMIN_TOTP_SECRET` | 16-character Base32 secret for Admin Google Authenticator 2FA | `JBSWY3DPEHPK3PXP` |
| `SECRET_KEY` | Application secret key | Any long random string |
| `JWT_SECRET_KEY` | JWT signing secret | Any long random string |
| `GEMINI_API_KEY` | *(Optional)* Default system Gemini API Key (Users can also provide their own on sign-up) | `AIzaSy...` |
| `GEMINI_MODEL` | Default Gemini Model | `gemini-2.5-flash` |
| `DATABASE_URL` | *(Optional)* Cloud PostgreSQL Connection String (Supabase, Neon, etc.) | `postgresql://...` |

---

## 💾 Database Configuration on Vercel

### 1. Default Mode (Zero-Config SQLite in `/tmp`)
- If you don't provide a `DATABASE_URL`, QuizForge automatically uses `sqlite:////tmp/quizforge.db`.
- All tables are created automatically on cold starts.
- *Note*: Vercel serverless functions have ephemeral `/tmp` storage, which may reset during function recycling.

### 2. Persistent Production Mode (Recommended: Supabase or Neon PostgreSQL)
For persistent production data on Vercel, connect a free PostgreSQL database:
1. Create a free project on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. Copy the **URI Connection String** (e.g., `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`).
3. Add the `DATABASE_URL` environment variable in Vercel.
4. QuizForge automatically connects to PostgreSQL via SQLAlchemy and initializes all schema tables on startup!

---

## ✅ Local Testing

Before pushing to Vercel, you can test everything locally using:
```bash
# Build frontend
npm run build

# Run local development servers
npm run dev
```
Both the local dev server and Vercel serverless setups use the exact same endpoints and logic.
