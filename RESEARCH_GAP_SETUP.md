# Research Gap Analysis Setup Guide

## Prerequisites

### 1. Install Ollama
Download and install Ollama from: https://ollama.com/

### 2. Install Llama 3.2 Model
After installing Ollama, run:
```bash
ollama pull llama3.2
```

### 3. Start Ollama Service
Start the Ollama service (this should happen automatically on installation):
```bash
ollama serve
```

The service should be running on `http://localhost:11434`

### 4. Verify Installation
Test that Ollama is working:

**Linux/Mac:**
```bash
curl http://localhost:11434/api/generate -d '{"model": "llama3.2", "prompt": "Hello, how are you?", "stream": false}'
```

**Windows (CMD/PowerShell):**
```powershell
$body = @'
{
  "model": "llama3.2",
  "prompt": "Hello, how are you?",
  "stream": false
}
'@
curl.exe http://localhost:11434/api/generate -H "Content-Type: application/json" -d $body
```

> **Troubleshooting:**
> If you see `405 method not allowed` in your browser, you are using GET instead of POST. Always use curl with `-d` to send a POST request.
> If you see JSON errors, make sure to include the `-H "Content-Type: application/json"` header and use the correct quoting/escaping for your shell.

## How Research Gap Analysis Works

1. **Related Paper Fetching**: Uses OpenAlex API to find papers related to the selected paper
2. **Future Work Extraction**: Analyzes abstracts and titles to identify common research directions
3. **Gap Generation**: Uses Ollama (Llama 3.2) to identify specific research gaps
4. **Validation**: Cross-checks gaps against existing literature to avoid suggesting already-explored areas

## API Integration

The system integrates with:
- **OpenAlex API**: For fetching related papers and validation
- **Ollama Local API**: For AI-powered gap analysis (runs locally for privacy)
- **Gemini AI**: For paper summarization (requires API key)

## Features

- **Smart Gap Detection**: Identifies specific, actionable research opportunities
- **Literature Validation**: Checks if similar work already exists
- **Confidence Scoring**: Rates the likelihood that each gap is valuable
- **Category Classification**: Groups gaps by type (methodology, application, theory, empirical)
- **Existing Work Warnings**: Alerts when related work is found

## Usage

1. Select a paper from the clustering interface
2. Click on the "Research Gaps" tab in the AI Analysis panel
3. Click "Find Research Gaps" to start the analysis
4. Review identified gaps with confidence scores and justifications
5. Use the findings to guide future research directions

## Performance Notes

- Analysis typically takes 30-60 seconds depending on the number of related papers
- Results are more accurate for papers in well-established research areas
- The system works best with papers that have substantial abstracts and clear research contexts
