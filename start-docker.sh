#!/bin/bash

# AI News App Docker Startup Script
# This script starts the application using Docker Compose with Crawl4AI

echo "Starting AI News App with Crawl4AI..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Change to the app directory
cd "$(dirname "$0")"

# Check if .env file exists, if not copy from .env.docker
if [ ! -f .env ]; then
    echo "Creating .env file from .env.docker template..."
    cp .env.docker .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and add your API keys:"
    echo "   - CRAWL4AI_API_TOKEN: Your Crawl4AI token"
    echo "   - OPENAI_API_KEY: Your OpenAI API key (for summarization)"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    docker-compose down
    exit
}

# Set up trap to call cleanup on script exit
trap cleanup EXIT INT TERM

# Pull latest images
echo "Pulling latest Docker images..."
docker pull unclecode/crawl4ai:latest

# Build the application images
echo "Building application images..."
docker-compose build

# Start all services
echo "Starting all services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check service health
echo "Checking service health..."
docker-compose ps

# Print access information
echo ""
echo "========================================="
echo "AI News App with Crawl4AI is running!"
echo "========================================="
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:8001"
echo "Crawl4AI: http://localhost:11235"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: Press Ctrl+C or run 'docker-compose down'"
echo "========================================="

# Follow logs
docker-compose logs -f