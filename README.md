# University Research Portal

A comprehensive research discovery platform with AI-powered paper analysis and research gap identification.

## 🔬 Features

### **Research Paper Clustering**
- **Hierarchical Organization**: 4-level clustering (Root → Branches → Subdomains → Topics)
- **Multiple Views**: List, Tree, and Density visualization modes
- **OpenAlex Integration**: Access to millions of academic papers
- **Smart Filtering**: Relevance-based paper positioning

### **AI-Powered Analysis**
- **Paper Summarization**: Comprehensive insights using Gemini AI
  - Technical overview and key findings
  - Methodology and research techniques
  - Advantages, limitations, and future directions
- **Research Gap Discovery**: Identify unexplored opportunities using Ollama AI
  - Related literature analysis
  - Gap validation against existing work
  - Confidence scoring and categorization

### **Interactive Visualization**
- **Density Heatmaps**: Papers positioned by relevance with color-coding
- **Hierarchical Trees**: Expandable cluster navigation
- **Paper Details**: Rich tooltips with abstracts and metadata

## 🚀 Quick Start

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- **For AI Features**:
  - Gemini API key (for paper summarization)
  - Ollama with Llama 3.2 (for research gap analysis)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Gemini API key to .env

# Start development server
npm run dev
```

### AI Setup
1. **Gemini AI**: Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Ollama**: Follow setup in [RESEARCH_GAP_SETUP.md](RESEARCH_GAP_SETUP.md)

## Project info

**URL**: https://lovable.dev/projects/0b3f4017-7a39-457d-8b84-7b6e79e2cae4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/0b3f4017-7a39-457d-8b84-7b6e79e2cae4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/0b3f4017-7a39-457d-8b84-7b6e79e2cae4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
