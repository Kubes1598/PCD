#!/bin/bash
echo "🛑 Stopping PCD Game servers..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
echo "✅ Servers stopped successfully!"
