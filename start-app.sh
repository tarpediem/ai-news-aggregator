#!/bin/bash

# AI News App Startup Script
# This script starts both the frontend and backend servers

echo "Starting AI News App..."

# Function to cleanup on exit
cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Set up trap to call cleanup on script exit
trap cleanup EXIT INT TERM

# Change to the app directory
cd "$(dirname "$0")"

# Start the scraper backend
echo "Starting scraper backend on port 8001..."
cd scraper-backend
npm install
node server.js &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start the frontend dev server
echo "Starting frontend on port 5173..."
npm install
npm run dev &
FRONTEND_PID=$!

# Print startup information
echo ""
echo "========================================="
echo "AI News App is running!"
echo "========================================="
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8001"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "========================================="

# Keep script running
wait