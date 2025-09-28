# Gemini AI Integration

The University Research Portal now includes AI-powered paper analysis using Google's Gemini AI model.

## Features

### AI Paper Summary
- **Comprehensive Analysis**: Generate detailed summaries including overview, key findings, and methodology
- **Technical Insights**: Extract techniques, advantages, and limitations from research papers
- **Future Research**: Identify potential research directions and improvements
- **Structured Output**: Organized tabs for easy navigation of analysis results

### Integration Points
- **Paper Selection**: Click on any paper in the cluster view to select it for AI analysis
- **Real-time Generation**: On-demand summary generation with progress indicators
- **Interactive UI**: Tabbed interface with overview, technical details, evaluation, and insights

## Setup

### 1. Get Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the API key

### 2. Configure Environment
1. Copy `.env.example` to `.env`
2. Add your Gemini API key:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

### 3. Usage
1. Search for papers using the clustering interface
2. Select a cluster to view papers
3. Click on any paper to select it for AI analysis
4. In the AI Analysis panel, click "Generate AI Summary"
5. View comprehensive analysis across four tabs:
   - **Overview**: Executive summary and key findings
   - **Technical**: Methods, techniques, and methodology
   - **Evaluation**: Advantages and limitations
   - **Insights**: Future research directions and AI insights

## Technical Implementation

### Components
- `AIPaperSummary.tsx`: Main AI analysis component with tabbed interface
- `geminiService.ts`: Service layer for Gemini AI API integration
- Updated `PaperSearchCluster.tsx`: Three-column layout with AI analysis

### AI Prompting Strategy
The system uses structured prompting to extract:
- **Overview**: High-level summary and significance
- **Key Findings**: Main discoveries and contributions
- **Techniques**: Methodologies and approaches used
- **Advantages**: Strengths and benefits of the approach
- **Limitations**: Constraints and areas for improvement
- **Future Work**: Potential research directions

### Error Handling
- API key validation
- Network error handling
- Graceful fallbacks for AI service unavailability
- User-friendly error messages

## Cost Considerations

Gemini AI API usage is charged per request. Consider:
- Implement caching for repeated paper summaries
- Set usage limits in production
- Monitor API costs through Google Cloud Console

## Security

- API keys are environment variables (not committed to version control)
- Client-side API calls (suitable for development/demo)
- For production, consider server-side proxy for API key security
