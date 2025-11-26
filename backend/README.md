# Research Hub Backend

A FastAPI-based backend service that integrates with OpenAlex API for research paper retrieval and Groq AI for intelligent hierarchical clustering.

## 🏗️ Architecture

```
Research Hub Backend
├── OpenAlex API Integration    # Fetch research papers
├── Groq AI Classification     # Intelligent clustering
├── Hierarchical Clustering    # Multi-level organization
└── FastAPI REST API          # Frontend integration
```

## 🚀 Features

- **Real-time Paper Search**: Fetch papers from OpenAlex's 200M+ paper database
- **AI-Powered Clustering**: Use Groq AI for intelligent paper classification
- **Hierarchical Structure**: Organize papers into branches → sub-categories → specific areas
- **Dynamic Clustering**: Generate new clusters based on paper content
- **RESTful API**: Clean API endpoints for frontend integration
- **Fallback Classification**: Keyword-based classification when AI is unavailable

## 📋 Prerequisites

- Python 3.8+
- Groq AI API key (get from [Groq Console](https://console.groq.com/keys))
- Internet connection (for OpenAlex API)

## 🛠️ Installation

### Option 1: Quick Setup (Recommended)
```bash
cd backend
python setup.py
```

### Option 2: Manual Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

## ⚙️ Configuration

1. **Get Groq API Key**:
   - Visit [Groq Console](https://console.groq.com/keys)
   - Create a new API key
   - Copy the key

2. **Configure Environment**:
   ```bash
   # Edit .env file
   GROQ_API_KEY=your_actual_groq_api_key_here
   ```

## 🏃‍♂️ Running the Server

```bash
# Activate virtual environment first
cd backend
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Start the server
python app.py
```

The server will start at `http://localhost:8000`

## 🧪 Testing

```bash
# Test the API endpoints
python test_api.py
```

## 📡 API Endpoints

### 1. Health Check
```http
GET /api/health
```
Returns server status and configuration info.

### 2. Search Papers Only
```http
GET /api/papers/search?query=machine learning&limit=20&year_from=2020&year_to=2024
```
Fetch papers from OpenAlex without clustering.

### 3. Search and Cluster (Main Endpoint)
```http
POST /api/search-and-cluster
Content-Type: application/json

{
  "query": "artificial intelligence",
  "limit": 50,
  "year_from": 2015,
  "year_to": 2024
}
```

**Response Format**:
```json
{
  "nodes": [
    {
      "id": "root",
      "label": "Research Papers",
      "level": 0,
      "papers": [],
      "paper_count": 50
    },
    {
      "id": "branch_cse",
      "label": "CSE",
      "level": 1,
      "parent_id": "root",
      "papers": [...],
      "paper_count": 25
    },
    {
      "id": "subcat_1",
      "label": "Artificial Intelligence",
      "level": 2,
      "parent_id": "branch_cse",
      "papers": [...],
      "paper_count": 15
    }
  ],
  "edges": [
    {
      "from": "root",
      "to": "branch_cse"
    },
    {
      "from": "branch_cse",
      "to": "subcat_1"
    }
  ]
}
```

## 🤖 AI Classification

The system uses **Groq AI** (Llama3-8b-8192 model) for intelligent paper classification:

### Classification Process:
1. **Paper Analysis**: Extract title, abstract, and concepts
2. **AI Prompt**: Send structured prompt to Groq AI
3. **Hierarchical Response**: Receive branch → sub-category → specific area
4. **Confidence Scoring**: AI provides confidence levels
5. **Dynamic Clusters**: Create new sub-categories as needed

### Main Branches:
- **CSE**: Computer Science & Engineering
- **ECE**: Electronics & Communication Engineering
- **EEE**: Electrical & Electronics Engineering
- **Mechanical**: Mechanical Engineering
- **Civil**: Civil Engineering

### Example AI Classification:
```json
{
  "paper_id": 0,
  "main_branch": "CSE",
  "sub_category": "Artificial Intelligence",
  "specific_area": "Machine Learning",
  "confidence": 0.95
}
```

## 📊 OpenAlex Integration

### Paper Data Retrieved:
- **Metadata**: Title, abstract, DOI, publication year
- **Authors**: Names, affiliations, institutions
- **Citations**: Citation count and influence
- **Concepts**: Research topics and keywords
- **Venue**: Journal/conference information
- **Access**: Direct links to full papers

### Search Features:
- **Keyword Search**: Natural language queries
- **Year Filtering**: Specify publication date ranges
- **Result Limiting**: Control number of papers returned
- **Citation Sorting**: Results sorted by impact

## 🔄 Frontend Integration

### CORS Configuration
The backend is configured to work with common frontend development ports:
- `http://localhost:3000` (React/Next.js)
- `http://localhost:5173` (Vite)
- `http://localhost:8080` (Vue/general)

### Sample Frontend Integration:
```javascript
// Search and cluster papers
const response = await fetch('http://localhost:8000/api/search-and-cluster', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'machine learning',
    limit: 50,
    year_from: 2020,
    year_to: 2024
  })
});

const clusterData = await response.json();
// Use clusterData.nodes and clusterData.edges for visualization
```

## 🚨 Error Handling

The API includes comprehensive error handling:

- **400 Bad Request**: Invalid parameters
- **404 Not Found**: No papers found for query
- **500 Internal Server Error**: API or processing errors
- **503 Service Unavailable**: External API failures

### Fallback Mechanisms:
- **Groq AI Unavailable**: Falls back to keyword-based classification
- **OpenAlex Timeout**: Retries with exponential backoff
- **Empty Results**: Returns structured empty response

## 📈 Performance

### Optimization Features:
- **Async Processing**: Non-blocking API calls
- **Request Limiting**: Prevents API abuse
- **Response Caching**: Future enhancement planned
- **Efficient Parsing**: Optimized data transformation

### Typical Response Times:
- Paper Search: 2-5 seconds
- AI Classification: 3-8 seconds
- Total Processing: 5-15 seconds (depending on paper count)

## 🔧 Troubleshooting

### Common Issues:

1. **"Cannot find module 'httpx'"**:
   ```bash
   pip install -r requirements.txt
   ```

2. **"GROQ_API_KEY not set"**:
   - Edit `.env` file and add your API key
   - Restart the server

3. **"OpenAlex API timeout"**:
   - Check internet connection
   - Reduce query complexity or limit

4. **"No papers found"**:
   - Try broader search terms
   - Adjust year range
   - Check spelling

### Debug Mode:
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python app.py
```

## 🔒 Security

- **API Key Protection**: Environment variables for sensitive data
- **CORS Restriction**: Limited to specified origins
- **Input Validation**: Pydantic models for request validation
- **Rate Limiting**: Built-in FastAPI protections

## 🚀 Deployment

### Production Deployment:
```bash
# Install production ASGI server
pip install gunicorn

# Run with Gunicorn
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Docker Deployment:
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📚 API Documentation

Once the server is running, visit:
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

This project is part of the University Research Portal system.

---

**Need Help?** Check the troubleshooting section or run `python test_api.py` to diagnose issues.
