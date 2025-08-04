#!/bin/bash

echo "🚀 Starting AI News Hub..."
echo "🔧 Checking dependencies..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🧹 Clearing any existing processes..."
pkill -f "vite" 2>/dev/null || true

echo "🔥 Starting development server..."
echo "📱 The app will be available at:"
echo "   - http://localhost:3000"
echo "   - http://127.0.0.1:3000"
echo ""
echo "🎯 If you can't connect:"
echo "   1. Try refreshing your browser"
echo "   2. Clear browser cache (Ctrl+Shift+R)"
echo "   3. Try a different browser"
echo "   4. Check if antivirus/firewall is blocking"
echo ""

# Start the server
npx vite --host 0.0.0.0 --port 3000