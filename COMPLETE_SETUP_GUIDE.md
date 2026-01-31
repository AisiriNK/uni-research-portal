# 🚀 Complete Project Setup Guide

**University Research Portal - One-Stop Setup Guide**

This guide will walk you through setting up the entire project from scratch. Follow these steps in order.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Environment Configuration](#environment-configuration)
4. [Firebase Setup](#firebase-setup)
5. [Redis Setup](#redis-setup)
6. [MCP Server Setup](#mcp-server-setup)
7. [Frontend Setup](#frontend-setup)
8. [Backend Setup](#backend-setup)
9. [Running the Application](#running-the-application)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.10 or higher) - [Download](https://www.python.org/)
- **Git** - [Download](https://git-scm.com/)
- **Redis** (v5.0 or higher) - [Download](https://redis.io/download)
- **Docker Desktop** (Optional, recommended for Redis) - [Download](https://www.docker.com/products/docker-desktop)
- **Google Account** (for Firebase)

### Verify Installation

```powershell
# Check Node.js
node --version

# Check npm
npm --version

# Check Python
python --version

# Check pip
pip --version

# Check Git
git --version
```

---

## Project Setup

### Step 1: Clone Repository

```powershell
# Clone the repository
git clone <YOUR_REPOSITORY_URL>
cd uni-research-portal
```

### Step 2: Install Dependencies

```powershell
# Install frontend dependencies
npm install

# Install Firebase SDK
npm install firebase

# Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..
```

---

## Environment Configuration

### Step 1: Create Environment File

The project uses a **single `.env` file** at the root for all services (frontend, backend, MCP server).

```powershell
# Copy the template
Copy-Item .env.example .env
```

### Step 2: Open .env for Editing

```powershell
# Open in notepad
notepad .env

# Or use VS Code
code .env
```

Your `.env` file structure:

```env
# =============================================================================
# Frontend Configuration (Vite - prefix with VITE_)
# =============================================================================

VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GROQ_API_KEY=your_groq_api_key_here
VITE_BACKEND_URL=http://localhost:8000

# Firebase Configuration (REQUIRED - get from Firebase Console)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123

# =============================================================================
# Backend Configuration (Python/FastAPI)
# =============================================================================

GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENALEX_BASE_URL=https://api.openalex.org
OPENALEX_EMAIL=your-email@example.com

HOST=0.0.0.0
PORT=8000
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080
LOG_LEVEL=INFO

# =============================================================================
# MCP Server Configuration (OPTIONAL - for advanced AI orchestration)
# =============================================================================

# Redis Configuration (REQUIRED if using MCP Server)
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
REDIS_MAX_CONNECTIONS=50

# ChromaDB Vector Storage (auto-configured, stores in ./mcp-server/chroma_data/)

# API Security (REQUIRED if using MCP Server)
API_KEY=your-super-secret-api-key-change-this
ADMIN_API_KEY=your-admin-api-key-change-this

# MCP Server Configuration
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_PORT=8001
ENVIRONMENT=development

# Context Configuration
DEFAULT_CONTEXT_TTL=3600
MAX_CONTEXT_SIZE_MB=10
ENABLE_FIRESTORE_PERSISTENCE=false

# Tool Execution Configuration
DEFAULT_TOOL_TIMEOUT=60
MAX_TOOL_RETRIES=3
CIRCUIT_BREAKER_THRESHOLD=5

# Workflow Configuration
MAX_WORKFLOW_TIMEOUT=300
MAX_CONCURRENT_STEPS=5

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

**Note**: Don't worry about filling everything now. We'll get the API keys in the next sections.

---

## Firebase Setup

Firebase is **required** for authentication. Follow these steps carefully.

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `uni-research-portal` (or your choice)
4. Disable Google Analytics (optional)
5. Click **"Create project"**
6. Wait for project creation to complete
7. Click **"Continue"**

### Step 2: Enable Authentication

1. In Firebase Console, click **"Build"** in left sidebar
2. Click **"Authentication"**
3. Click **"Get started"**
4. Click **"Sign-in method"** tab
5. Click **"Email/Password"**
6. Toggle **"Enable"** switch ON
7. Click **"Save"**

### Step 3: Create Firestore Database

1. In Firebase Console, click **"Build"** in left sidebar
2. Click **"Firestore Database"**
3. Click **"Create database"**
4. Select **"Start in test mode"** (we'll deploy security rules later)
5. Choose your region (e.g., `asia-south1` or closest to you)
6. Click **"Enable"**
7. Wait for database creation

### Step 4: Get Firebase Configuration

1. In Firebase Console, click the **gear icon** (⚙️) next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** (`</>`) to add a web app
5. Register app nickname: `Research Portal Web`
6. **Do NOT** check "Firebase Hosting" (optional)
7. Click **"Register app"**
8. **Copy the configuration values** shown:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

9. Click **"Continue to console"**

### Step 5: Add Firebase Config to .env

Open `.env` and update Firebase variables with the values you copied:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

### Step 6: Deploy Firestore Security Rules

```powershell
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init

# When prompted:
# - Select: Firestore (use Space to select, Enter to confirm)
# - Use an existing project
# - Select your project from the list
# - Accept default for firestore.rules (press Enter)
# - Accept default for firestore.indexes.json (press Enter)

# Deploy security rules
firebase deploy --only firestore:rules
```

**Expected output:**
```
✔ Deploy complete!
```

---

## Redis Setup

Redis is **optional** but highly recommended for the MCP Server (advanced AI orchestration features).

### Option 1: Docker (Recommended - Easiest)

**Step 1: Install Docker Desktop**

1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. Install and restart your computer
3. Open Docker Desktop and wait for it to start

**Step 2: Run Redis in Docker**

```powershell
# Pull Redis image
docker pull redis:latest

# Run Redis container
docker run --name research-portal-redis -p 6379:6379 -d redis:latest

# Verify Redis is running
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE          STATUS          PORTS
abc123def456   redis:latest   Up 5 seconds    0.0.0.0:6379->6379/tcp
```

**Step 3: Test Redis Connection**

```powershell
# Connect to Redis
docker exec -it research-portal-redis redis-cli

# Inside Redis CLI, test:
# redis> ping
# PONG
# redis> exit
```

### Option 2: Windows Subsystem for Linux (WSL)

**Step 1: Install WSL**

```powershell
# Run as Administrator
wsl --install
```

**Step 2: Install Redis in WSL**

```bash
# Inside WSL Ubuntu terminal
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo service redis-server start

# Test Redis
redis-cli ping
# Should return: PONG
```

### Option 3: Native Windows Installation

**Step 1: Download Redis for Windows**

1. Visit [Redis Windows Fork](https://github.com/tporadowski/redis/releases)
2. Download the `.msi` installer
3. Install Redis
4. Redis will start automatically as a Windows service

**Step 2: Verify Installation**

```powershell
# Check if Redis service is running
Get-Service redis*

# Test connection
redis-cli ping
```

### Redis Configuration in .env

Once Redis is running, verify in `.env`:

```env
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
```

**Note:** If Redis requires a password, set it:
```env
REDIS_PASSWORD=your_redis_password
```

---

## MCP Server Setup

The MCP (Model Context Protocol) Server provides **advanced AI orchestration** with multi-agent workflows, context sharing, and vector storage. This is **optional** but enables powerful features.

### What MCP Server Provides

- 🤖 **Multi-Agent Orchestration** - Coordinate Groq, Gemini, OpenAlex simultaneously
- 🧠 **Context Memory** - Share research context across all AI operations
- 📊 **Vector Storage** - ChromaDB for semantic paper search and clustering
- 🔄 **Workflow Automation** - Pre-built research analysis workflows
- 📈 **Performance Monitoring** - Prometheus metrics and health checks

### Prerequisites Check

Before proceeding, ensure:
- ✅ Redis is installed and running (see [Redis Setup](#redis-setup))
- ✅ Python 3.10+ is installed
- ✅ Root `.env` file is configured

### Step 1: Install MCP Server Dependencies

```powershell
# Navigate to MCP server directory
cd mcp-server

# Install Python packages
pip install -r requirements.txt
```

**Expected packages:**
- `fastapi` - Web framework
- `redis` - Redis client
- `chromadb` - Vector database (auto-configured)
- `sentence-transformers` - Text embeddings
- `scikit-learn` - ML clustering
- `groq`, `google-generativeai` - AI integrations

### Step 2: Configure MCP Server Environment

The MCP server uses the root `.env` file. Verify these variables exist:

```env
# Required for MCP Server
REDIS_URL=redis://localhost:6379/0
API_KEY=your-super-secret-api-key-change-this
ADMIN_API_KEY=your-admin-api-key-change-this

# AI Service Keys (same as backend)
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# MCP Server Port (default: 8001)
MCP_SERVER_PORT=8001
```

**Security Note:** Generate strong API keys:

```powershell
# Generate random API keys (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### Step 3: Initialize Vector Database (ChromaDB)

ChromaDB is automatically configured and stores data locally:

```powershell
# ChromaDB will create this directory automatically:
# mcp-server/chroma_data/
```

**No manual setup required!** ChromaDB is embedded and managed by the MCP server.

### Step 4: Verify MCP Server Setup

```powershell
# From mcp-server directory
python verify_installation.py
```

**Expected output:**
```
✓ Python version: 3.10.x
✓ Redis connection: OK
✓ ChromaDB initialized
✓ All dependencies installed
✓ API keys configured
✓ MCP Server ready to start
```

### Step 5: Test MCP Server

```powershell
# Start MCP server
python main.py
```

**Expected output:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Redis connected: localhost:6379
INFO:     ChromaDB initialized: ./chroma_data
INFO:     Uvicorn running on http://0.0.0.0:8001
```

**Keep this terminal running.**

### Step 6: Test MCP Health Endpoint

Open a **new terminal**:

```powershell
# Test health check
curl http://localhost:8001/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-13T10:30:00.000000",
  "redis": "connected",
  "chromadb": "initialized",
  "firestore": "disabled"
}
```

### Understanding ChromaDB Storage

ChromaDB stores vector embeddings locally:

```
mcp-server/
  ├── chroma_data/           # Vector database (auto-created)
  │   ├── chroma.sqlite3     # Metadata storage
  │   └── [embedding files]  # Vector data
  ├── main.py
  └── requirements.txt
```

**Storage Location:** All vector data is stored in `mcp-server/chroma_data/`

**Data Persistence:**
- ✅ Vectors persist between restarts
- ✅ No external database required
- ✅ Automatic cleanup of old data
- ✅ Optimized for research paper embeddings

### Optional: Docker Compose Setup

For production or easier management, use Docker Compose:

**Create `docker-compose.yml` in project root:**

```yaml
version: '3.8'

services:
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  mcp-server:
    build: ./mcp-server
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379/0
    env_file:
      - .env
    depends_on:
      - redis
    volumes:
      - ./mcp-server/chroma_data:/app/chroma_data

volumes:
  redis_data:
```

**Start with Docker Compose:**

```powershell
docker-compose up -d
```

---

## Get API Keys

### Groq API Key (REQUIRED for Backend)

1. Visit [Groq Console](https://console.groq.com/keys)
2. Sign up or log in
3. Click **"Create API Key"**
4. Give it a name: `Research Portal`
5. Copy the key
6. Add to `.env`:
   ```env
   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
   ```

### Gemini API Key (Optional)

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with Google account
3. Click **"Create API Key"**
4. Copy the key
5. Add to `.env`:
   ```env
   VITE_GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXX
   GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXX
   ```

---

## Frontend Setup

Frontend is already configured! Just verify:

```powershell
# From project root
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in 500 ms

➜  Local:   http://localhost:8080/
➜  Network: use --host to expose
```

**Note**: Don't access it yet - we need to start the backend first.

Press `Ctrl+C` to stop for now.

---

## Backend Setup

### Step 1: Verify Python Environment

```powershell
cd backend

# Check if dependencies are installed
pip list | findstr groq
pip list | findstr fastapi
```

If missing, install:
```powershell
pip install -r requirements.txt
```

### Step 2: Test Backend

```powershell
# From backend directory
python app.py
```

**Expected output:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Press `Ctrl+C` to stop for now.

---

## Running the Application

Now let's run everything together!

### Terminal 1: Redis (If using MCP Server)

**Only if you set up MCP Server:**

```powershell
# If using Docker
docker start research-portal-redis

# If using WSL
wsl -d Ubuntu -e sudo service redis-server start

# If using Windows native Redis
# (It should auto-start as a service)

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Terminal 2: MCP Server (Optional)

**Only if you set up MCP Server:**

```powershell
# Navigate to MCP server
cd d:\uni-research-portal\mcp-server

# Start MCP server
python main.py
```

**Should show:**
```
INFO:     Redis connected: localhost:6379
INFO:     ChromaDB initialized: ./chroma_data
INFO:     Uvicorn running on http://0.0.0.0:8001
```

**Keep this terminal open and running.**

### Terminal 3: Backend (Required)

```powershell
# Navigate to backend
cd d:\uni-research-portal\backend

# Start backend server
python app.py
```

**Should show:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Keep this terminal open and running.**

### Terminal 4: Frontend (Required)

Open a **NEW terminal** (keep other services running):

```powershell
# Navigate to project root
cd d:\uni-research-portal

# Start frontend
npm run dev
```

**Should show:**
```
➜  Local:   http://localhost:8080/
```

**Keep this terminal open and running.**

### Access the Application

Open your browser and go to:

**http://localhost:8080**

You should see the **Login page**!

### Service Architecture

Your services are now running on:

| Service | Port | Required | Purpose |
|---------|------|----------|---------|
| **Frontend** | 8080 | ✅ Yes | React UI |
| **Backend API** | 8000 | ✅ Yes | FastAPI + Research services |
| **MCP Server** | 8001 | ⚠️ Optional | AI orchestration + workflows |
| **Redis** | 6379 | ⚠️ Optional | MCP context storage |
| **ChromaDB** | - | ⚠️ Optional | Vector embeddings (embedded in MCP) |

---

## Testing

### Step 1: Create Student Account

1. Go to **http://localhost:8080/signup**
2. Fill in the form:
   - **Role**: Select "Student"
   - **Name**: Test Student
   - **Email**: student@test.com
   - **Department**: Computer Science
   - **Registration Number**: CS2024001
   - **Password**: test123456
   - **Confirm Password**: test123456
3. Click **"Sign Up"**

**Expected**: Redirected to Student Dashboard

### Step 2: Verify in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **"Authentication"** → Should see 1 user (student@test.com)
4. Click **"Firestore Database"** → Should see:
   - Collection: `users` → Document with role: "student"
   - Collection: `students` → Document with student details

### Step 3: Test Login

1. Click **"Logout"** button on dashboard
2. You're redirected to login page
3. Enter:
   - **Email**: student@test.com
   - **Password**: test123456
4. Click **"Sign In"**

**Expected**: Successfully logged in to Student Dashboard

### Step 4: Create Teacher Account

1. Logout if logged in
2. Go to **http://localhost:8080/signup**
3. Fill in the form:
   - **Role**: Select "Teacher"
   - **Name**: Test Teacher
   - **Email**: teacher@test.com
   - **Department**: Computer Science
   - **Employee ID**: EMP2024001
   - **Password**: test123456
   - **Confirm Password**: test123456
4. Click **"Sign Up"**

**Expected**: Redirected to Teacher Dashboard

### Step 5: Test Backend API

In a new terminal:

```powershell
# Test health endpoint
curl http://localhost:8000/api/health

# Or open in browser
# http://localhost:8000/api/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "groq_api_configured": true,
  "openalex_url": "https://api.openalex.org"
}
```

---

## Verification Checklist

Run through this checklist to ensure everything is working:

- [ ] `.env` file exists in project root with all Firebase keys
- [ ] Firebase project created and Authentication enabled
- [ ] Firestore database created and security rules deployed
- [ ] Backend starts without errors on port 8000
- [ ] Frontend starts without errors on port 8080
- [ ] Can access http://localhost:8080 and see login page
- [ ] Can create student account successfully
- [ ] Student appears in Firebase Authentication
- [ ] Student document created in Firestore
- [ ] Can login with student credentials
- [ ] Can create teacher account successfully
- [ ] Teacher appears in Firebase Authentication
- [ ] Teacher document created in Firestore
- [ ] Can logout and login again
- [ ] Backend API health check responds

---

## Troubleshooting

### Issue: "Cannot find module 'firebase'"

**Solution:**
```powershell
npm install firebase
```

### Issue: "VITE_FIREBASE_API_KEY is not defined"

**Solution:**
1. Check `.env` file exists in project root (not in subdirectories)
2. Verify variable names start with `VITE_`
3. Restart frontend: `npm run dev`

### Issue: "Firebase: Error (auth/api-key-not-valid)"

**Solution:**
1. Go to Firebase Console → Project Settings
2. Copy the correct API key
3. Update `VITE_FIREBASE_API_KEY` in `.env`
4. Restart frontend

### Issue: "Missing or insufficient permissions" in Firestore

**Solution:**
```powershell
firebase deploy --only firestore:rules
```

### Issue: Backend shows "GROQ_API_KEY not found"

**Solution:**
1. Verify `GROQ_API_KEY` is in root `.env` file
2. Check the key is valid at [Groq Console](https://console.groq.com/keys)
3. Restart backend: `python backend/app.py`

### Issue: "Port 8080 already in use"

**Solution:**
```powershell
# Windows - Find and kill process
netstat -ano | findstr :8080
# Note the PID and kill it
taskkill /PID <PID> /F
```

### Issue: "Port 8000 already in use"

**Solution:**
```powershell
# Windows - Find and kill process
netstat -ano | findstr :8000
# Note the PID and kill it
taskkill /PID <PID> /F
```

### Issue: "Port 8001 already in use" (MCP Server)

**Solution:**
```powershell
# Windows - Find and kill process
netstat -ano | findstr :8001
# Note the PID and kill it
taskkill /PID <PID> /F
```

### Issue: Redis connection failed

**Solution:**

**For Docker:**
```powershell
# Check if Redis container is running
docker ps

# If not running, start it
docker start research-portal-redis

# Or create new container
docker run --name research-portal-redis -p 6379:6379 -d redis:latest

# Test connection
redis-cli ping
```

**For WSL:**
```bash
# Start Redis in WSL
wsl -d Ubuntu -e sudo service redis-server start

# Check status
wsl -d Ubuntu -e sudo service redis-server status
```

**For Windows Native:**
```powershell
# Check Redis service
Get-Service redis*

# Start service if stopped
Start-Service redis
```

### Issue: "Cannot connect to Redis" in MCP Server

**Solution:**
1. Verify Redis is running: `redis-cli ping` (should return `PONG`)
2. Check `REDIS_URL` in `.env`: `redis://localhost:6379/0`
3. If Redis has password, add: `REDIS_PASSWORD=your_password`
4. Restart MCP server

### Issue: ChromaDB initialization failed

**Solution:**
```powershell
# ChromaDB creates directory automatically
# But you can manually create it:
cd mcp-server
New-Item -ItemType Directory -Path "chroma_data" -Force

# Check permissions
icacls chroma_data
```

### Issue: MCP Server "API key invalid"

**Solution:**
1. Check `API_KEY` is set in `.env`
2. Use the same key in API requests: `-H "X-API-Key: your-api-key"`
3. Generate new key if needed:
   ```powershell
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
   ```

### Issue: "sentence-transformers model download failed"

**Solution:**
```powershell
# First run downloads ML models (2-3 GB)
# Requires internet connection
# Wait for download to complete

# If download fails, manually download:
cd mcp-server
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
```

### Issue: MCP Server slow or unresponsive

**Solution:**
1. Check Redis memory: `redis-cli INFO memory`
2. Check ChromaDB disk space (requires ~1-5 GB)
3. Reduce concurrent operations in `.env`:
   ```env
   MAX_CONCURRENT_STEPS=3
   ```
4. Clear old context data:
   ```powershell
   redis-cli FLUSHDB
   ```

### Issue: Python module not found

**Solution:**
```powershell
cd backend
pip install -r requirements.txt
```

### Issue: Can't login after signup

**Solution:**
1. Check browser console for errors (F12)
2. Verify Firebase Authentication is enabled
3. Check Firestore security rules are deployed
4. Try clearing browser cache and cookies

### Issue: Environment variables not loading

**Solution:**
1. `.env` must be in project root (not in `backend/` or `src/`)
2. Frontend vars must start with `VITE_`
3. Restart both frontend and backend after changing `.env`
4. Check for typos in variable names (case-sensitive)

---

## Common Commands Reference

### Start All Services

**Minimal Setup (No MCP Server):**
```powershell
# Terminal 1: Backend
cd d:\uni-research-portal\backend
python app.py

# Terminal 2: Frontend
cd d:\uni-research-portal
npm run dev
```

**Full Setup (With MCP Server):**
```powershell
# Terminal 1: Redis
docker start research-portal-redis
# OR for WSL: wsl -d Ubuntu -e sudo service redis-server start

# Terminal 2: MCP Server
cd d:\uni-research-portal\mcp-server
python main.py

# Terminal 3: Backend
cd d:\uni-research-portal\backend
python app.py

# Terminal 4: Frontend
cd d:\uni-research-portal
npm run dev
```

### Stop Services

```powershell
# Press Ctrl+C in each terminal

# Stop Redis Docker container
docker stop research-portal-redis
```

### Reinstall Dependencies

```powershell
# Frontend
npm install

# Backend
cd backend
pip install -r requirements.txt
cd ..

# MCP Server
cd mcp-server
pip install -r requirements.txt
cd ..
```

### Redis Commands

```powershell
# Test Redis connection
redis-cli ping

# Check Redis status
redis-cli INFO

# View stored keys
redis-cli KEYS "*"

# Clear all data (use with caution!)
redis-cli FLUSHDB

# Monitor Redis activity
redis-cli MONITOR
```

### MCP Server Commands

```powershell
# Check MCP health
curl http://localhost:8001/health

# View available tools
curl http://localhost:8001/tools

# Check metrics
curl http://localhost:8001/metrics

# Verify installation
cd mcp-server
python verify_installation.py
```

### ChromaDB Commands

```powershell
# View ChromaDB storage size
Get-ChildItem -Path "mcp-server\chroma_data" -Recurse | Measure-Object -Property Length -Sum

# Clear ChromaDB data (use with caution!)
Remove-Item -Path "mcp-server\chroma_data" -Recurse -Force
# ChromaDB will recreate on next startup
```

### Update Environment Variables

```powershell
# Edit .env
notepad .env

# Restart all services after changes
```

### Deploy Firebase Rules

```powershell
firebase deploy --only firestore:rules
```

### Check Logs

**Frontend logs**: Check the terminal running `npm run dev`  
**Backend logs**: Check the terminal running `python app.py`  
**MCP Server logs**: Check the terminal running `python main.py`  
**Redis logs**: `docker logs research-portal-redis` (for Docker)  
**Browser console**: Press F12 in browser → Console tab

---

## Project Structure

```
uni-research-portal/
├── .env                        # ✅ YOUR CONFIGURATION (git-ignored)
├── .env.example                # Template
├── package.json                # Frontend dependencies
├── vite.config.ts              # Vite config (port 8080)
├── firebase.json               # Firebase config
├── firestore.rules             # Security rules
│
├── src/                        # Frontend React code
│   ├── config/
│   │   └── firebase.ts         # Firebase initialization
│   ├── contexts/
│   │   └── AuthContext.tsx     # Authentication state
│   ├── pages/
│   │   ├── Login.tsx           # Login page
│   │   ├── Signup.tsx          # Signup page
│   │   ├── StudentDashboard.tsx
│   │   └── TeacherDashboard.tsx
│   ├── components/
│   │   └── ProtectedRoute.tsx  # Route protection
│   ├── services/
│   │   ├── mcpService.ts       # MCP client integration
│   │   ├── openAlexService.ts  # OpenAlex API
│   │   └── geminiService.ts    # Gemini AI
│   └── App.tsx                 # Main app + routes
│
├── backend/                    # Backend Python code
│   ├── app.py                  # Main FastAPI server
│   ├── requirements.txt        # Python dependencies
│   ├── utils.py                # Utility functions
│   └── mcp_integration.py      # MCP integration
│
└── mcp-server/                 # ⚠️ OPTIONAL - AI Orchestration
    ├── main.py                 # MCP server entry point
    ├── requirements.txt        # MCP dependencies
    ├── orchestrator.py         # Workflow engine
    ├── models.py               # Data models
    ├── config.py               # Configuration
    ├── chroma_data/            # Vector DB storage (auto-created)
    ├── tools/                  # AI tool integrations
    │   ├── openalex_tool.py    # OpenAlex integration
    │   ├── groq_tool.py        # Groq AI integration
    │   ├── gemini_tool.py      # Gemini AI integration
    │   ├── embedding_tool.py   # Text embeddings
    │   └── clustering_tool.py  # Paper clustering
    └── storage/                # Storage backends
        ├── redis_storage.py    # Redis cache
        ├── vector_storage.py   # ChromaDB wrapper
        └── storage_manager.py  # Unified storage layer
```

---

## Access Points

| Service | URL | Required | Purpose |
|---------|-----|----------|---------|
| **Frontend** | http://localhost:8080 | ✅ Yes | Main application UI |
| Login | http://localhost:8080/login | ✅ Yes | Login page |
| Signup | http://localhost:8080/signup | ✅ Yes | User registration |
| Student Dashboard | http://localhost:8080/student-dashboard | ✅ Yes | Student dashboard |
| Teacher Dashboard | http://localhost:8080/teacher-dashboard | ✅ Yes | Teacher dashboard |
| **Backend API** | http://localhost:8000 | ✅ Yes | Backend API |
| API Health | http://localhost:8000/api/health | ✅ Yes | Backend health check |
| API Docs | http://localhost:8000/docs | ✅ Yes | FastAPI Swagger UI |
| **MCP Server** | http://localhost:8001 | ⚠️ Optional | AI orchestration |
| MCP Health | http://localhost:8001/health | ⚠️ Optional | MCP health check |
| MCP Tools | http://localhost:8001/tools | ⚠️ Optional | Available AI tools |
| MCP Metrics | http://localhost:8001/metrics | ⚠️ Optional | Prometheus metrics |
| **Redis** | localhost:6379 | ⚠️ Optional | Context storage |
| **ChromaDB** | (Embedded) | ⚠️ Optional | Vector embeddings |
| **Firebase Console** | https://console.firebase.google.com | ✅ Yes | Manage Firebase |

---

## Default Test Accounts

Create these for testing:

**Student Account:**
```
Email: student@test.com
Password: test123456
Name: Test Student
Department: Computer Science
Reg No: CS2024001
```

**Teacher Account:**
```
Email: teacher@test.com
Password: test123456
Name: Test Teacher
Department: Computer Science
Emp ID: EMP2024001
```

---

## Security Reminders

⚠️ **IMPORTANT SECURITY NOTES:**

- ✅ `.env` is in `.gitignore` - Never commit it to git
- ✅ Use different Firebase projects for dev/staging/production
- ✅ Rotate API keys regularly
- ✅ Use strong passwords for test accounts
- ✅ Deploy security rules before going to production

---

## Next Steps

Once setup is complete:

1. **Customize the application** for your university
2. **Add more features** as needed
3. **Configure production environment** with separate Firebase project
4. **Set up hosting** (Firebase Hosting, Vercel, etc.)
5. **Add custom domains**
6. **Enable email verification** (optional)
7. **Add password reset** functionality (optional)

---

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

---

## Getting Help

### Documentation Files

- [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) - Detailed environment guide
- [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md) - Detailed Firebase guide
- [`backend/README.md`](backend/README.md) - Backend specific documentation
- [`ENV_MIGRATION_NOTICE.md`](ENV_MIGRATION_NOTICE.md) - Environment migration guide

### Debug Commands

```powershell
# Check Node.js version
node --version

# Check Python version
python --version

# Verify .env exists
Get-Item .env

# List installed npm packages
npm list --depth=0

# List installed Python packages (Backend)
pip list

# List installed Python packages (MCP Server)
cd mcp-server
pip list
cd ..

# Check Firebase CLI
firebase --version

# Test Firebase connection
firebase projects:list

# Check Redis connection
redis-cli ping

# Check Redis version
redis-cli INFO server

# View Redis memory usage
redis-cli INFO memory

# Check Docker containers
docker ps

# Check Redis Docker logs
docker logs research-portal-redis

# Test MCP Server health
curl http://localhost:8001/health

# Test Backend health
curl http://localhost:8000/api/health

# Check all ports in use
netstat -ano | findstr "8000 8001 8080 6379"

# Verify ChromaDB directory
Get-ChildItem mcp-server\chroma_data

# Check Python packages for MCP
python -c "import chromadb, redis, sentence_transformers; print('All packages OK')"
```

---

## 🎉 Congratulations!

You've successfully set up the University Research Portal!

**What you accomplished:**
- ✅ Set up development environment
- ✅ Configured Firebase Authentication
- ✅ Created Firestore database
- ✅ Set up frontend (React + Vite)
- ✅ Set up backend (Python + FastAPI)
- ✅ (Optional) Set up Redis for context storage
- ✅ (Optional) Set up MCP Server with AI orchestration
- ✅ (Optional) Configured ChromaDB for vector embeddings
- ✅ Created test accounts
- ✅ Verified everything works

**Your application is now running with:**
- 🔐 Secure authentication (Firebase Auth)
- 👥 Role-based access control (Student/Teacher)
- 🛡️ Protected routes with authorization
- 💾 Real-time database (Firestore)
- 🌐 RESTful API (FastAPI)
- 🤖 (Optional) AI orchestration (MCP Server)
- 🧠 (Optional) Context memory (Redis)
- 📊 (Optional) Vector search (ChromaDB)

**Architecture Overview:**

**Minimal Setup:**
```
Frontend (React) → Backend (FastAPI) → Firebase + External APIs
```

**Full Setup with MCP:**
```
Frontend → Backend → MCP Server → Redis + ChromaDB
                  ↘ Firebase + External APIs
```

**Next Steps:**
1. Explore MCP Server workflows at http://localhost:8001/docs
2. Read [MCP_INTEGRATION_GUIDE.md](MCP_INTEGRATION_GUIDE.md) for advanced features
3. Check [mcp-server/QUICKSTART.md](mcp-server/QUICKSTART.md) for quick examples

**Happy coding! 🚀**
