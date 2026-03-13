# Pipeline Timeout Fix

## Issue
The report processing pipeline was timing out after 120 seconds, causing `500 Internal Server Error` when processing documents.

## Root Cause
The pipeline performs multiple time-consuming operations:
1. **STEP 1**: Parse arguments and validate input (< 1s)
2. **STEP 2**: Chapter separation from Word document (varies by file size)
3. **STEP 3**: Read and extract chapters from separated files (varies by chapter count)
4. **STEP 4**: Gemini API calls for each chapter with rate-limiting and retries (30-60s per chapter)
5. **STEP 5**: Typst compilation for each chapter to PDF (10-30s per chapter)
6. **STEP 6**: PDF merging (1-5s)
7. **STEP 7**: PDF to DOCX conversion (5-15s)

For documents with multiple chapters, this easily exceeds 120 seconds.

## Solution Applied

### 1. Increased Default Timeout
- **File**: `backend/app.py` (line ~564)
- **Change**: Timeout increased from **120 seconds to 600 seconds (10 minutes)**
- **Implementation**: Made configurable via environment variable `PIPELINE_TIMEOUT_SECONDS`

```python
pipeline_timeout = int(os.getenv("PIPELINE_TIMEOUT_SECONDS", "600"))
result = subprocess.run(command, capture_output=True, text=True, timeout=pipeline_timeout)
```

### 2. Enhanced Logging
- **File**: `backend/ai_report_pipeline.py`
- **Changes**: Added elapsed time tracking for each pipeline step

Each step now logs:
- Step completion time
- Elapsed time for that step
- Progress information

Example output:
```
[STEP 4] Gemini responses collected: 5 (elapsed: 45.23s)
[STEP 5] Typst compilation complete (elapsed: 78.15s)
[STEP 7] PDF to DOCX conversion complete (elapsed: 12.34s)
```

## Configuration

### Setting Custom Timeout
Add to your `.env` file:
```
PIPELINE_TIMEOUT_SECONDS=900  # 15 minutes
```

### Recommended Values
- **Small documents** (1-2 chapters): `300` seconds (5 minutes)
- **Medium documents** (3-5 chapters): `600` seconds (10 minutes) - **default**
- **Large documents** (6+ chapters): `900-1200` seconds (15-20 minutes)

## Monitoring Performance

The enhanced logging now shows:
1. Which step takes the longest
2. Total pipeline execution time
3. Detailed error information with timing

Monitor logs during processing:
```bash
tail -f backend.log | grep "STEP"
```

## Next Steps if Still Timing Out

If documents still timeout:

1. **Increase timeout further** in `.env`:
   ```
   PIPELINE_TIMEOUT_SECONDS=1200  # 20 minutes
   ```

2. **Optimize Gemini API calls**:
   - Adjust `GEMINI_MAX_WORKERS` (default: 1, can increase for parallel processing)
   - Check `GEMINI_TIMEOUT_SECONDS` (default: 120s)
   - Verify API rate limits aren't being hit

3. **Profile the pipeline**:
   - Check which step is slowest in the logs
   - STEP 4 (Gemini) and STEP 5 (Typst) typically take the longest
   - Consider document size - very large documents need more time

4. **Verify system resources**:
   - Check disk space for temporary files
   - Monitor CPU/memory during processing
   - Ensure no other resource-intensive processes are running

## Files Modified
- `backend/app.py` - Updated timeout handling
- `backend/ai_report_pipeline.py` - Added detailed timing logs
