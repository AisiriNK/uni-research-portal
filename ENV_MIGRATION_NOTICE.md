# ⚠️ ENVIRONMENT CONFIGURATION MIGRATION NOTICE

## What Changed?

The project has been migrated from **multiple `.env` files** to a **single unified `.env` file** at the project root.

---

## 🔄 Migration Summary

### Before (Multiple .env files ❌)
```
uni-research-portal/
├── .env              # Frontend config
├── backend/
│   └── .env          # Backend config
└── mcp-server/
    └── .env          # MCP server config
```

### After (Single .env file ✅)
```
uni-research-portal/
└── .env              # ALL configuration
```

---

## ✅ What Was Done

### 1. **Consolidated .env.example**
- Merged `backend/.env.example` and `mcp-server/.env.example` into root `.env.example`
- Root `.env.example` now contains all variables for:
  - Frontend (VITE_ prefixed)
  - Backend (Python/FastAPI)
  - MCP Server (optional)

### 2. **Updated Python Files**
Modified to load `.env` from project root:

- ✅ [`backend/app.py`](backend/app.py) - Updated `load_dotenv()` to use root path
- ✅ [`backend/mcp_integration.py`](backend/mcp_integration.py) - Updated path resolution
- ✅ [`mcp-server/main.py`](mcp-server/main.py) - Updated path resolution
- ✅ [`mcp-server/verify_installation.py`](mcp-server/verify_installation.py) - Updated path resolution

### 3. **Updated Documentation**
- ✅ [`backend/README.md`](backend/README.md) - Added note about root .env
- ✅ [`README.md`](README.md) - Updated setup instructions
- ✅ Created [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) - Comprehensive guide
- ✅ Updated [`.gitignore`](.gitignore) - Explicitly ignore subdirectory .env files

### 4. **Removed Redundant Files**
- ❌ Deleted `backend/.env.example`
- ❌ Deleted `mcp-server/.env.example`

---

## 🚀 Action Required

### If You Already Have Multiple .env Files

**Step 1: Backup your existing .env files**
```powershell
# Backup existing configs
Copy-Item .env .env.backup
Copy-Item backend\.env backend\.env.backup -ErrorAction SilentlyContinue
Copy-Item mcp-server\.env mcp-server\.env.backup -ErrorAction SilentlyContinue
```

**Step 2: Create new unified .env**
```powershell
# Copy the new template
Copy-Item .env.example .env
```

**Step 3: Merge your API keys**
Edit the new `.env` file and copy your API keys from the backup files:

```env
# From root .env.backup (frontend keys)
VITE_FIREBASE_API_KEY=...
VITE_GEMINI_API_KEY=...
VITE_GROQ_API_KEY=...

# From backend/.env.backup (backend keys)
GROQ_API_KEY=...
GEMINI_API_KEY=...

# From mcp-server/.env.backup (MCP keys)
API_KEY=...
REDIS_URL=...
```

**Step 4: Delete old .env files**
```powershell
# Remove old subdirectory .env files
Remove-Item backend\.env -ErrorAction SilentlyContinue
Remove-Item mcp-server\.env -ErrorAction SilentlyContinue
```

**Step 5: Verify configuration**
```powershell
# Check frontend can load env
npm run dev

# Check backend can load env
cd backend
python -c "import os; from pathlib import Path; from dotenv import load_dotenv; root=Path.cwd().parent; load_dotenv(root/'.env'); print('GROQ_API_KEY:', 'SET' if os.getenv('GROQ_API_KEY') else 'NOT SET')"
cd ..
```

---

## 📋 Variable Mapping

Here's how to map your old variables to the new single .env:

### Frontend Variables (Keep VITE_ prefix)
| Old Location | New Location | Variable |
|--------------|--------------|----------|
| Root `.env` | Root `.env` | `VITE_FIREBASE_API_KEY` |
| Root `.env` | Root `.env` | `VITE_GEMINI_API_KEY` |
| Root `.env` | Root `.env` | `VITE_GROQ_API_KEY` |
| Root `.env` | Root `.env` | All other `VITE_*` |

### Backend Variables
| Old Location | New Location | Variable |
|--------------|--------------|----------|
| `backend/.env` | Root `.env` | `GROQ_API_KEY` |
| `backend/.env` | Root `.env` | `GEMINI_API_KEY` |
| `backend/.env` | Root `.env` | `OPENALEX_BASE_URL` |
| `backend/.env` | Root `.env` | `HOST`, `PORT`, `DEBUG` |
| `backend/.env` | Root `.env` | `ALLOWED_ORIGINS` |

### MCP Server Variables
| Old Location | New Location | Variable |
|--------------|--------------|----------|
| `mcp-server/.env` | Root `.env` | `REDIS_URL` |
| `mcp-server/.env` | Root `.env` | `API_KEY` |
| `mcp-server/.env` | Root `.env` | `ADMIN_API_KEY` |
| `mcp-server/.env` | Root `.env` | `MCP_SERVER_HOST` |
| `mcp-server/.env` | Root `.env` | All other MCP vars |

---

## ✅ Benefits of Single .env

### Advantages
- ✅ **Single source of truth** - No more config drift
- ✅ **Easier setup** - New developers copy one file
- ✅ **Less duplication** - Same API keys across services
- ✅ **Simpler maintenance** - Update keys in one place
- ✅ **Better organization** - All config variables visible at once
- ✅ **Reduced errors** - Can't forget to update multiple files

### Trade-offs
- ⚠️ File is larger (but well-organized with sections)
- ⚠️ Contains keys for all services (but properly secured in .gitignore)

---

## 🔒 Security Notes

### What's Protected
- ✅ Root `.env` is in `.gitignore`
- ✅ Subdirectory `.env` files are explicitly ignored
- ✅ `.env.example` contains NO actual secrets
- ✅ Backup files (`.env.backup`) are in `.gitignore` via `*.local` pattern

### Best Practices
- 🔐 Never commit `.env` to git
- 🔐 Use different values for dev/staging/prod
- 🔐 Rotate API keys regularly
- 🔐 Use strong, unique API keys for MCP server
- 🔐 Don't share your `.env` file

---

## 🧪 Testing Your Migration

### Test Frontend
```powershell
npm run dev
# Open http://localhost:8080
# Check browser console for any env errors
```

### Test Backend
```powershell
cd backend
python app.py
# Check console for successful startup
# Visit http://localhost:8000/api/health
cd ..
```

### Test MCP Server (if used)
```powershell
cd mcp-server
python main.py
# Check for successful startup
cd ..
```

### Verify All Keys Loaded
```powershell
node verify-firebase-setup.js
```

---

## 🆘 Troubleshooting

### Issue: "Can't find environment variable"

**Solution:**
1. Check `.env` exists in project root (not subdirectories)
2. Verify variable name and spelling
3. For frontend vars, ensure `VITE_` prefix
4. Restart all services after updating `.env`

### Issue: "Backend shows GROQ_API_KEY not found"

**Solution:**
1. Ensure `GROQ_API_KEY` is in root `.env` (not `backend/.env`)
2. Check Python loading code updated correctly
3. Restart backend: `python backend/app.py`

### Issue: "Multiple .env files causing conflicts"

**Solution:**
1. Delete ALL `.env` files except root one:
   ```powershell
   Remove-Item backend\.env, mcp-server\.env -Force
   ```
2. Keep only root `.env`

### Issue: "Lost my API keys during migration"

**Solution:**
- Check `.env.backup` files
- Check `backend/.env.backup`
- Check `mcp-server/.env.backup`
- Retrieve from original sources (Firebase Console, Groq Console, etc.)

---

## 📞 Need Help?

1. Read [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for complete guide
2. Check [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for Firebase configuration
3. Review [backend/README.md](backend/README.md) for backend setup
4. See root `.env.example` for all available variables

---

## 🎉 Migration Complete!

Once you've followed the steps above:

- ✅ Single `.env` file in project root
- ✅ All services load from same configuration
- ✅ Simplified maintenance and setup
- ✅ Ready for development

**Note**: Remember to restart all running services (frontend, backend, MCP server) after migration!
