#!/bin/bash

# Youform Clone MVP Setup Script
# This script helps set up the full-stack application

echo "🚀 Welcome to Youform Clone MVP Setup"
echo "=====================================\n"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '18.0.0') ? 0 : 1)" 2>/dev/null; then
    echo "❌ Node.js version 18+ is required. Current version: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check for MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB is not installed or not in PATH."
    echo "   Please install MongoDB Community Edition:"
    echo "   https://docs.mongodb.com/manual/installation/"
    echo "   Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas"
    echo ""
fi

echo "📦 Installing dependencies..."

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
if npm install; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
if npm install; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

cd ..

echo "\n🔧 Setting up environment files..."

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    echo "Creating backend .env file..."
    cp backend/.env.example backend/.env
    echo "✅ Backend .env file created"
    echo "⚠️  Please update backend/.env with your MongoDB URI and JWT secret"
else
    echo "✅ Backend .env file already exists"
fi

# Check if frontend .env.local exists
if [ ! -f "frontend/.env.local" ]; then
    echo "Creating frontend .env.local file..."
    cp frontend/.env.example frontend/.env.local
    echo "✅ Frontend .env.local file created"
else
    echo "✅ Frontend .env.local file already exists"
fi

# Create uploads directory
if [ ! -d "uploads" ]; then
    mkdir uploads
    echo "✅ Uploads directory created"
fi

echo "\n🎯 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Update backend/.env with your MongoDB connection string"
echo "2. Start MongoDB (if running locally)"
echo "3. Run the development servers:"
echo ""
echo "   # Terminal 1 - Start backend"
echo "   cd backend && npm run dev"
echo ""
echo "   # Terminal 2 - Start frontend"
echo "   cd frontend && npm run dev"
echo ""
echo "4. Access your application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo ""
echo "🎉 Happy form building!"