# Gemini "Too Many Requests" Error - Root Cause & Solutions

## The Problem You're Experiencing

Even though you're not intentionally sending many requests, you're hitting Gemini's rate limits. This happens due to **3 cascading factors**:

---

## 🔴 Root Cause #1: Aggressive Retry Mechanism

**What's happening:**
- Backend retries **5 times by default** on ANY failure
- Each retry attempt counts as a new API request
- Multiple chapters × 5 retries = exponential requests

**Example:**
```
Processing 10 chapters with retry logic:
- Chapter 1: 1 request succeeds (1 total)
- Chapter 2: 1 attempt fails → retry 5 times (5 total)
- Chapter 3-10: Similar pattern
= Potentially 40+ requests for "10 chapters"
```

**Fixed in .env:**
```dotenv
GEMINI_MAX_RETRIES=2          # Was: 5 (now only retry if really needed)
GEMINI_RETRY_BACKOFF=3.0      # Longer wait between retries
GEMINI_MIN_REQUEST_INTERVAL=5.0  # 5 seconds between ANY requests
```

---

## 🔴 Root Cause #2: Exposed API Key

**What's happening:**
- Your API key is visible in `.env` file
- Anyone with repo access can use your quota
- If shared or committed to Git, attackers can abuse it

**Impact:**
- Your quota gets consumed by requests you didn't make
- Unaware usage multiplies the rate limiting

**Fix:**
```bash
# 1. Regenerate your API key immediately
# Go to: https://aistudio.google.com/app/apikey
# Delete old key and create new one

# 2. Add .env to .gitignore
echo ".env" >> .gitignore

# 3. Use environment variables instead
# In production, use secret management:
#   - AWS Secrets Manager
#   - Azure Key Vault  
#   - Google Cloud Secret Manager
#   - Vercel/Netlify Environment Variables
```

---

## 🔴 Root Cause #3: Rate Limit Handling Issues

**What's happening:**
- Code respects HTTP 429 (rate limit) responses
- BUT: 429 comes AFTER you've already hit the limit
- By then, damage is done

**Google Gemini Free Tier Limits:**
- ~60 requests per minute
- ~32,000 tokens per minute
- You likely exceeded both

**New Configuration Added:**
```dotenv
# These help track usage (you can implement monitoring)
GEMINI_REQUESTS_PER_MINUTE=50    # Leave headroom below 60
GEMINI_TOKENS_PER_MINUTE=32000   # Monitor token usage
```

---

## ✅ Recommended Immediate Actions

### 1️⃣ **Regenerate Your API Key (HIGH PRIORITY)**
```
1. Go to https://aistudio.google.com/app/apikey
2. Click on your current key
3. Delete it
4. Create a new key
5. Update the key in your .env file
6. Restart the backend server
```

### 2️⃣ **Update Backend Code** (Optional but Recommended)

Add request deduplication in `ai_report_pipeline.py` (line 437):

```python
# Add this before calling Gemini:
request_hash = hashlib.md5(text.encode()).hexdigest()
if request_hash in recent_requests:
    logger.info("Skipping duplicate request")
    return recent_requests[request_hash]
recent_requests[request_hash] = response
```

### 3️⃣ **Monitor Usage**

```python
# Add to backend for monitoring:
total_requests = 0
total_tokens = 0

# In call_gemini():
total_requests += 1
total_tokens += count_tokens(text)

if total_requests >= GEMINI_REQUESTS_PER_MINUTE:
    raise Exception("Rate limit approached - backing off")
```

### 4️⃣ **Implement Request Queue**

Add simple rate limiting queue in backend:

```python
import time
from collections import deque

class RateLimiter:
    def __init__(self, requests_per_minute=50):
        self.max_requests = requests_per_minute
        self.window = 60  # seconds
        self.requests = deque()
    
    def acquire(self):
        now = time.time()
        # Remove old requests outside window
        while self.requests and self.requests[0] < now - self.window:
            self.requests.popleft()
        
        if len(self.requests) >= self.max_requests:
            sleep_time = self.window - (now - self.requests[0])
            time.sleep(sleep_time)
        
        self.requests.append(time.time())

gemini_limiter = RateLimiter(50)
# Before calling Gemini:
gemini_limiter.acquire()
```

---

## 🛡️ Long-Term Security Solutions

### For Development:
```bash
# Use environment variables only
export GEMINI_API_KEY="your-new-key"
# Don't store in .env if possible
```

### For Production:
```
Use managed secret services:
- AWS: Secrets Manager
- Azure: Key Vault
- GCP: Secret Manager
- Vercel/Netlify: Environment Variables (UI)
- Docker Secrets (if using containers)
```

### .gitignore Update:
```gitignore
# Add to your .gitignore:
.env
.env.local
.env.*.local
*.key
*.pem
secrets/
```

---

## 📊 Current Configuration

**Old (causing too many requests):**
- `GEMINI_MAX_RETRIES=5` → Causes 5x amplification
- `GEMINI_MIN_REQUEST_INTERVAL=2.5s` → Too aggressive
- Multiple retry models → Multiplies failures

**New (rate limit friendly):**
- `GEMINI_MAX_RETRIES=2` → Minimal retries (urgent fixes only)
- `GEMINI_MIN_REQUEST_INTERVAL=5.0s` → Respectful spacing
- Single model focus → No fallback multiplication
- Better error handling → Fail fast, don't retry blindly

---

## 🔍 How to Verify It's Fixed

1. **Check Gemini API usage:**
   - Go to: https://aistudio.google.com/app/apikey
   - Look for usage stats
   - Should show requests dropping significantly

2. **Test with small document:**
   - Upload small .docx (1-2 pages)
   - Should complete without 429 errors
   - Check backend logs

3. **Monitor request spacing:**
   ```bash
   # Check backend logs for timing:
   tail -f backend.log | grep "GEMINI"
   # Should see 5+ second gaps between requests
   ```

---

## ⚠️ If Still Getting Errors

**Next steps:**
1. Check if new API key is actually being used (restart backend)
2. Verify no other processes are using the API key
3. Wait 1 hour for rate limit window to reset
4. Consider upgrading to Gemini API paid tier for higher limits
5. Switch to Groq API (which you have, and it's usually more lenient)

---

## Alternative: Use Groq Instead

If Gemini continues having issues, use Groq (already configured):

```bash
# In backend/app.py, switch to Groq API
# Change: from `call_gemini()` to `classify_papers_with_groq()`
# Groq has more generous rate limits and faster responses
```

---

## Summary

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Too many 429 errors | 5x retry mechanism | Changed `GEMINI_MAX_RETRIES=2` |
| Quota consumed fast | Exposed API key | Regenerate key immediately |
| Continuous failures | Rate limit not respected | Added spacing + monitoring config |

**Next action:** Regenerate your API key right now!
