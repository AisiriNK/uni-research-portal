# Environment Configuration Guide

## 📋 Single `.env` File Architecture

This project uses a **unified environment configuration** approach with a single `.env` file at the project root.

### ✅ Benefits

- **Single source of truth** - All configuration in one place
- **Easier maintenance** - No need to sync multiple .env files
- **Consistent values** - Same API keys used across frontend, backend, and MCP server
- **Simplified setup** - Copy one file, configure once

---

## 📁 File Structure

```
uni-research-portal/
├── .env                    ✅ Your actual config (git-ignored)
├── .env.example            ✅ Template file
├── .gitignore              ✅ Contains .env
├── backend/
│   ├── app.py              ✅ Loads from root .env
│   └── mcp_integration.py  ✅ Loads from root .env
├── mcp-server/
│   ├── main.py             ✅ Loads from root .env
│   └── verify_installation.py ✅ Loads from root .env
└── src/
    └── config/
        └── firebase.ts     ✅ Loads from root .env
```

**⚠️ IMPORTANT**: Do NOT create `.env` files in subdirectories (`backend/` or `mcp-server/`). They will be ignored.

---

## 🚀 Setup Instructions

### Step 1: Copy the Template

```bash
# From project root
cp .env.example .env
```

### Step 2: Edit Configuration

Open `.env` in your text editor:

```bash
# Windows
notepad .env

# macOS
open -e .env

# Linux
nano .env
```

### Step 3: Add Your API Keys

Replace placeholder values with your actual credentials:

```env
# Frontend (Vite)
VITE_GEMINI_API_KEY=your_actual_gemini_key
VITE_GROQ_API_KEY=your_actual_groq_key
VITE_FIREBASE_API_KEY=your_actual_firebase_key
# ... etc

# Backend
GROQ_API_KEY=your_actual_groq_key
GEMINI_API_KEY=your_actual_gemini_key

# MCP Server (optional)
API_KEY=change_this_to_secure_key
ADMIN_API_KEY=change_this_to_secure_admin_key
```

---

## 🔑 Environment Variables Reference

### Frontend Variables (VITE_ prefix)

These are used by the React frontend:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Optional | Gemini AI API key |
| `VITE_GROQ_API_KEY` | Optional | Groq AI API key |
| `VITE_BACKEND_URL` | Optional | Backend URL (default: http://localhost:8000) |
| `VITE_FIREBASE_API_KEY` | **Required** | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Required** | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | **Required** | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | **Required** | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | **Required** | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | **Required** | Firebase app ID |

### Backend Variables

These are used by the Python backend:

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | **Required** | Groq AI API key for paper clustering |
| `GEMINI_API_KEY` | Optional | Gemini AI API key |
| `OPENALEX_BASE_URL` | Optional | OpenAlex API URL (default set) |
| `OPENALEX_EMAIL` | Optional | Your email for OpenAlex (better rate limits) |
| `HOST` | Optional | Backend host (default: 0.0.0.0) |
| `PORT` | Optional | Backend port (default: 8000) |
| `DEBUG` | Optional | Debug mode (default: True) |
| `ALLOWED_ORIGINS` | Optional | CORS allowed origins |
| `LOG_LEVEL` | Optional | Logging level (default: INFO) |

### MCP Server Variables (Optional)

Only needed if you're using the MCP server:

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | Optional | Redis connection URL |
| `REDIS_PASSWORD` | Optional | Redis password |
| `API_KEY` | Optional | API key for MCP server |
| `ADMIN_API_KEY` | Optional | Admin API key |
| `MCP_SERVER_HOST` | Optional | MCP server host (default: 0.0.0.0) |
| `MCP_SERVER_PORT` | Optional | MCP server port (default: 8001) |
| `ENVIRONMENT` | Optional | Environment (development/production) |

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep `.env` file in project root only
- Add `.env` to `.gitignore` (already done)
- Use different values for development and production
- Rotate API keys regularly
- Use strong, unique API keys for MCP server

### ❌ DON'T:
- Commit `.env` to version control
- Share your `.env` file
- Use production credentials in development
- Create duplicate `.env` files in subdirectories
- Hard-code API keys in source code

---

## 🔍 How It Works

### Frontend (Vite)

Vite automatically loads environment variables prefixed with `VITE_`:

```typescript
// src/config/firebase.ts
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // ... etc
};
```

### Backend (Python)

Backend loads `.env` from project root using `python-dotenv`:

```python
# backend/app.py
from pathlib import Path
from dotenv import load_dotenv

# Load from root .env
root_dir = Path(__file__).parent.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)
```

### MCP Server (Python)

MCP server also loads from root:

```python
# mcp-server/main.py
from pathlib import Path
from dotenv import load_dotenv

# Load from root .env
root_dir = Path(__file__).parent.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)
```

---

## 🧪 Verification

### Check Environment Loading

**Frontend:**
```bash
npm run dev
# Check browser console for any env variable errors
```

**Backend:**
```bash
cd backend
python -c "import os; from pathlib import Path; from dotenv import load_dotenv; root=Path.cwd().parent; load_dotenv(root/'.env'); print('GROQ_API_KEY:', os.getenv('GROQ_API_KEY')[:20]+'...' if os.getenv('GROQ_API_KEY') else 'NOT SET')"
```

**MCP Server:**
```bash
cd mcp-server
python -c "import os; from pathlib import Path; from dotenv import load_dotenv; root=Path.cwd().parent; load_dotenv(root/'.env'); print('API_KEY:', os.getenv('API_KEY')[:20]+'...' if os.getenv('API_KEY') else 'NOT SET')"
```

---

## 📝 Getting API Keys

### Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create/select your project
3. Go to Project Settings (⚙️)
4. Scroll to "Your apps" section
5. Click Web icon (`</>`)
6. Copy all configuration values

### Groq API Key

1. Visit [Groq Console](https://console.groq.com/keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key

### Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with Google account
3. Create an API key
4. Copy the key

---

## 🚨 Troubleshooting

### Issue: "Environment variable not found"

**Solution:**
1. Check `.env` file exists in project root
2. Verify variable name matches exactly (case-sensitive)
3. For frontend vars, ensure `VITE_` prefix
4. Restart dev server after changing `.env`

### Issue: "Backend can't find .env"

**Solution:**
1. Verify `.env` is in project root (not in `backend/`)
2. Check Python code loads from correct path
3. Ensure `python-dotenv` is installed: `pip install python-dotenv`

### Issue: "Frontend vars not loading"

**Solution:**
1. Variables must start with `VITE_`
2. Restart Vite dev server: `npm run dev`
3. Clear browser cache
4. Check for typos in variable names

### Issue: "Multiple .env files causing conflicts"

**Solution:**
1. Delete any `.env` files in `backend/` and `mcp-server/`
2. Keep only root `.env` file
3. Restart all services

---

## 📖 Related Documentation

- [Firebase Setup Guide](FIREBASE_SETUP.md)
- [Backend README](backend/README.md)
- [MCP Server Guide](mcp-server/QUICKSTART.md)
- [Quick Start Guide](QUICKSTART.md)

---

## ✅ Checklist

Before running the application:

- [ ] `.env` file exists in project root
- [ ] All required Firebase variables are set
- [ ] Groq API key is configured (for backend)
- [ ] No duplicate `.env` files in subdirectories
- [ ] `.env` is in `.gitignore`
- [ ] API keys are valid and active

---

**🎉 You're ready to go! All services will now use the same environment configuration.**
