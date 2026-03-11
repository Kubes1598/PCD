#!/bin/bash

# Poisoned Candy Duel - Deployment Script
# This script automates the setup and deployment of both backend and frontend

set -e  # Exit on any error

echo "🍭 Poisoned Candy Duel - Deployment Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    print_status "Python 3 found"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_status "Node.js found"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_status "npm found"
    
    # Check if Expo CLI is installed
    if ! command -v expo &> /dev/null; then
        print_warning "Expo CLI not found, installing..."
        npm install -g @expo/cli
    fi
    print_status "Expo CLI ready"
}

# Setup backend
setup_backend() {
    echo ""
    echo "🐍 Setting up Python backend..."
    
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    print_status "Activating virtual environment..."
    source venv/bin/activate
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    pip install -r requirements.txt
    
    # Test if backend starts
    print_status "Testing backend startup..."
    timeout 10s python -m uvicorn api:app --host 0.0.0.0 --port 8000 &
    sleep 3
    
    # Check if backend is responding
    if curl -s http://localhost:8000/health > /dev/null; then
        print_status "Backend is working correctly"
        pkill -f uvicorn
    else
        print_error "Backend failed to start properly"
        pkill -f uvicorn
        exit 1
    fi
    
    cd ..
}

# Setup frontend
setup_frontend() {
    echo ""
    echo "📱 Setting up React Native frontend..."
    
    cd frontend
    
    # Install dependencies
    print_status "Installing Node.js dependencies..."
    npm install
    
    # Check if metro can start
    print_status "Testing frontend setup..."
    timeout 10s npx expo start --non-interactive &
    sleep 5
    pkill -f expo
    
    print_status "Frontend setup completed"
    
    cd ..
}

# Run backend in development mode
run_backend() {
    echo ""
    echo "🚀 Starting backend server..."
    cd backend
    source venv/bin/activate
    python -m uvicorn api:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"
    cd ..
}

# Run frontend in development mode
run_frontend() {
    echo ""
    echo "📱 Starting frontend development server..."
    cd frontend
    npx expo start &
    FRONTEND_PID=$!
    echo "Frontend started with PID: $FRONTEND_PID"
    cd ..
}

# Production deployment
deploy_production() {
    echo ""
    echo "🌐 Deploying to production..."
    
    # Backend production deployment
    echo "Deploying backend..."
    cd backend
    source venv/bin/activate
    
    # Install production dependencies
    pip install gunicorn
    
    # Create production start script
    cat > start_production.sh << 'EOF'
#!/bin/bash
source venv/bin/activate
gunicorn api:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
EOF
    chmod +x start_production.sh
    
    print_status "Backend production setup completed"
    cd ..
    
    # Frontend production build
    echo "Building frontend for production..."
    cd frontend
    
    # Build for production
    npx expo export --platform all
    
    print_status "Frontend production build completed"
    cd ..
    
    print_status "Production deployment ready!"
    echo "To start production backend: cd backend && ./start_production.sh"
    echo "Frontend build is in frontend/dist/"
}

# Main deployment function
main() {
    case $1 in
        "setup")
            check_prerequisites
            setup_backend
            setup_frontend
            print_status "Setup completed successfully!"
            echo ""
            echo "Next steps:"
            echo "  - Run development: ./deploy.sh dev"
            echo "  - Deploy production: ./deploy.sh prod"
            ;;
        "dev")
            check_prerequisites
            run_backend
            sleep 2
            run_frontend
            
            print_status "Development servers started!"
            echo ""
            echo "Backend: http://localhost:8000"
            echo "Frontend: Follow Expo CLI instructions"
            echo ""
            echo "Press Ctrl+C to stop all servers"
            
            # Wait for interrupt
            trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" INT
            wait
            ;;
        "prod")
            check_prerequisites
            deploy_production
            ;;
        "test")
            echo "🧪 Running tests..."
            
            # Test backend
            cd backend
            source venv/bin/activate
            python -m pytest -v
            cd ..
            
            # Test frontend
            cd frontend
            npm test
            cd ..
            
            print_status "All tests completed!"
            ;;
        "clean")
            echo "🧹 Cleaning up..."
            
            # Clean backend
            cd backend
            rm -rf venv __pycache__ .pytest_cache
            cd ..
            
            # Clean frontend  
            cd frontend
            rm -rf node_modules .expo dist
            cd ..
            
            print_status "Cleanup completed!"
            ;;
        *)
            echo "Usage: ./deploy.sh [setup|dev|prod|test|clean]"
            echo ""
            echo "Commands:"
            echo "  setup  - Install dependencies and setup project"
            echo "  dev    - Run development servers"
            echo "  prod   - Deploy to production"
            echo "  test   - Run all tests"
            echo "  clean  - Clean all build artifacts"
            exit 1
            ;;
    esac
}

main $1 