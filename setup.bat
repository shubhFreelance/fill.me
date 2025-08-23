@echo off
echo 🚀 Welcome to Youform Clone MVP Setup
echo =====================================
echo.

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

echo.
echo 📦 Installing dependencies...

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed

REM Install frontend dependencies
echo Installing frontend dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)
echo ✅ Frontend dependencies installed

cd ..

echo.
echo 🔧 Setting up environment files...

REM Check if backend .env exists
if not exist "backend\.env" (
    echo Creating backend .env file...
    copy "backend\.env.example" "backend\.env"
    echo ✅ Backend .env file created
    echo ⚠️  Please update backend\.env with your MongoDB URI and JWT secret
) else (
    echo ✅ Backend .env file already exists
)

REM Check if frontend .env.local exists
if not exist "frontend\.env.local" (
    echo Creating frontend .env.local file...
    copy "frontend\.env.example" "frontend\.env.local"
    echo ✅ Frontend .env.local file created
) else (
    echo ✅ Frontend .env.local file already exists
)

REM Create uploads directory
if not exist "uploads" (
    mkdir uploads
    echo ✅ Uploads directory created
)

echo.
echo 🎯 Setup Complete!
echo ==================
echo.
echo Next steps:
echo 1. Update backend\.env with your MongoDB connection string
echo 2. Start MongoDB (if running locally)
echo 3. Run the development servers:
echo.
echo    # Terminal 1 - Start backend
echo    cd backend ^&^& npm run dev
echo.
echo    # Terminal 2 - Start frontend  
echo    cd frontend ^&^& npm run dev
echo.
echo 4. Access your application:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:3001
echo.
echo 🎉 Happy form building!
echo.
pause