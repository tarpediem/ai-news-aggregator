#!/bin/bash

# AI News App - Full Stack Startup Script
echo "🚀 Starting AI News App Full Stack..."

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        echo "⚠️  Port $port is already in use"
        return 1
    fi
    return 0
}

# Check if ports are available
if ! check_port 8000; then
    echo "❌ Backend port 8000 is in use. Please stop the service running on port 8000."
    exit 1
fi

if ! check_port 5173; then
    echo "❌ Frontend port 5173 is in use. Please stop the service running on port 5173."
    exit 1
fi

echo "✅ Ports are available"

# Start backend scraper service
echo "🔧 Starting backend scraper service..."
cd scraper-backend
npm install --silent
npm start &
BACKEND_PID=$!

echo "📡 Backend scraper service started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend React app..."
cd ..
npm install --silent
npm run dev &
FRONTEND_PID=$!

echo "🌐 Frontend React app started (PID: $FRONTEND_PID)"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo ""
echo "🎉 AI News App is running!"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:8000"
echo "📊 Health Check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID