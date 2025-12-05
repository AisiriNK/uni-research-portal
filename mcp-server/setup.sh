#!/bin/bash

# MCP Server Setup Script
# Run this to set up the MCP server from scratch

set -e

echo "========================================="
echo "  MCP Server Setup"
echo "========================================="

# Check Python version
echo -e "\n1. Checking Python version..."
python_version=$(python --version 2>&1 | awk '{print $2}')
required_version="3.10"

if ! python -c "import sys; exit(0 if sys.version_info >= (3, 10) else 1)"; then
    echo "❌ Python 3.10+ required. You have: $python_version"
    exit 1
fi
echo "✓ Python $python_version"

# Check if Docker is installed
echo -e "\n2. Checking Docker..."
if command -v docker &> /dev/null; then
    echo "✓ Docker found: $(docker --version)"
    HAS_DOCKER=true
else
    echo "⚠ Docker not found. Will use local Python setup."
    HAS_DOCKER=false
fi

# Create .env file
echo -e "\n3. Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env file"
    echo "⚠ Please edit .env and set your API keys!"
else
    echo "✓ .env already exists"
fi

# Install Python dependencies
echo -e "\n4. Installing Python dependencies..."
pip install -r requirements.txt
echo "✓ Dependencies installed"

# Choose setup method
if [ "$HAS_DOCKER" = true ]; then
    echo -e "\n5. Choose setup method:"
    echo "   1) Docker Compose (recommended)"
    echo "   2) Local Python"
    read -p "Enter choice [1-2]: " choice
    
    if [ "$choice" = "1" ]; then
        echo -e "\nStarting with Docker Compose..."
        docker-compose up -d
        echo "✓ Services started"
        
        # Wait for services
        echo "Waiting for services to be ready..."
        sleep 5
        
        # Health check
        if curl -f http://localhost:8001/health > /dev/null 2>&1; then
            echo "✓ MCP Server is healthy!"
        else
            echo "⚠ Server might not be ready yet. Check logs: docker-compose logs"
        fi
    else
        echo -e "\nLocal setup selected."
        echo "Please ensure Redis is running (redis-server)"
        echo "Then start the server: python main.py"
    fi
else
    echo -e "\n5. Install Redis if not already installed"
    echo "Then run: python main.py"
fi

echo -e "\n========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env and set API_KEY and other credentials"
echo "  2. Test the server:"
echo "     curl http://localhost:8001/health"
echo "  3. Read QUICKSTART.md for usage examples"
echo ""
echo "For help, see:"
echo "  - QUICKSTART.md (5-minute guide)"
echo "  - README.md (full documentation)"
echo ""
