# Youform Clone MVP - Development Guide

## Table of Contents
- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)

## Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Automated Setup (Recommended)**
   ```bash
   # Linux/Mac
   chmod +x setup.sh && ./setup.sh
   
   # Windows
   setup.bat
   ```

2. **Manual Setup**
   ```bash
   # Install dependencies
   cd backend && npm install
   cd ../frontend && npm install
   
   # Setup environment files
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   
   # Create uploads directory
   mkdir uploads
   ```

3. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

4. **Access Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, MongoDB
- **Authentication**: JWT
- **File Upload**: Multer
- **Validation**: Joi, express-validator

### Project Structure
```
youform-clone/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # Reusable components
│   │   ├── lib/            # Utilities and contexts
│   │   └── types/          # TypeScript definitions
│   ├── public/             # Static assets
│   └── package.json
├── backend/                  # Express.js API
│   ├── src/
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Custom middleware
│   │   └── config/         # Configuration files
│   └── package.json
├── uploads/                  # File upload storage
└── README.md
```

## API Documentation

### Base URL
Development: `http://localhost:3001/api`

### Authentication Endpoints

#### POST /auth/signup
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "jwt_token",
  "user": {
    "_id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### POST /auth/login
Authenticate user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### GET /auth/me
Get current user profile (requires authentication).

### Form Management Endpoints

#### GET /forms
Get all forms for authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search query
- `sortBy` (optional): Sort field (default: updatedAt)
- `sortOrder` (optional): Sort order (asc/desc, default: desc)

#### POST /forms
Create a new form.

**Request Body:**
```json
{
  "title": "Contact Form",
  "description": "Get in touch with us",
  "fields": [
    {
      "type": "text",
      "label": "Full Name",
      "required": true,
      "placeholder": "Enter your name"
    },
    {
      "type": "email",
      "label": "Email Address",
      "required": true
    }
  ],
  "customization": {
    "primaryColor": "#3b82f6",
    "fontFamily": "Inter"
  },
  "isPublic": true
}
```

#### GET /forms/:id
Get single form by ID.

#### PUT /forms/:id
Update form.

#### DELETE /forms/:id
Delete form (soft delete).

### Public Form Endpoints

#### GET /public/forms/:publicUrl
Get public form by public URL.

#### POST /public/forms/:publicUrl/submit
Submit response to public form.

**Request Body:**
```json
{
  "responses": {
    "field_id_1": "John Doe",
    "field_id_2": "john@example.com"
  },
  "metadata": {
    "timezone": "America/New_York",
    "language": "en-US"
  }
}
```

### Response Management Endpoints

#### GET /responses/forms/:formId
Get responses for a specific form.

#### GET /responses/forms/:formId/export
Export form responses to CSV.

#### DELETE /responses/:responseId
Delete a response.

## Database Schema

### User Model
```javascript
{
  email: String (unique, required),
  password: String (hashed, required),
  firstName: String (optional),
  lastName: String (optional),
  isActive: Boolean (default: true),
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Form Model
```javascript
{
  title: String (required),
  description: String (optional),
  fields: [FormField],
  customization: {
    primaryColor: String (default: "#3b82f6"),
    fontFamily: String (default: "Inter"),
    logoUrl: String (optional)
  },
  isPublic: Boolean (default: true),
  isActive: Boolean (default: true),
  userId: ObjectId (ref: User, required),
  analytics: {
    views: Number (default: 0),
    submissions: Number (default: 0)
  },
  publicUrl: String (unique),
  embedCode: String,
  createdAt: Date,
  updatedAt: Date
}
```

### FormField Schema
```javascript
{
  id: String (uuid, required),
  type: String (enum: [text, textarea, email, dropdown, radio, checkbox, date, file]),
  label: String (required),
  placeholder: String (optional),
  required: Boolean (default: false),
  options: [String] (for dropdown, radio, checkbox),
  validation: {
    minLength: Number,
    maxLength: Number,
    pattern: String
  },
  order: Number (default: 0)
}
```

### FormResponse Model
```javascript
{
  formId: ObjectId (ref: Form, required),
  responses: Object (required),
  submittedAt: Date (default: now),
  ipAddress: String,
  userAgent: String,
  metadata: {
    referrer: String,
    screenResolution: String,
    timezone: String,
    language: String
  },
  isValid: Boolean (default: true),
  validationErrors: [ValidationError]
}
```

## Development Workflow

### Adding New Features

1. **Backend Changes**
   - Add/modify models in `backend/src/models/`
   - Create/update routes in `backend/src/routes/`
   - Add middleware if needed in `backend/src/middleware/`

2. **Frontend Changes**
   - Update types in `frontend/src/types/`
   - Add/modify pages in `frontend/src/app/`
   - Create components in `frontend/src/components/`

3. **Testing**
   - Test API endpoints with tools like Postman
   - Test frontend functionality in browser
   - Verify form creation, sharing, and response collection

### Code Style Guidelines

- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use Tailwind CSS for styling
- Implement proper error handling
- Add JSDoc comments for functions
- Use semantic HTML elements

## Deployment

### Environment Variables

**Backend (.env)**
```env
MONGODB_URI=mongodb://localhost:27017/youform-clone
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

**Frontend (.env.local)**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_FRONTEND_URL=https://yourdomain.com
```

### Production Deployment

1. **Backend Deployment** (e.g., Railway, Heroku, DigitalOcean)
   - Set environment variables
   - Ensure MongoDB is accessible
   - Configure file upload storage

2. **Frontend Deployment** (e.g., Vercel, Netlify)
   - Set environment variables
   - Configure build settings for Next.js

3. **Database**
   - Use MongoDB Atlas for production
   - Set up proper indexes for performance
   - Configure backups

### Performance Considerations

- Enable MongoDB indexes on frequently queried fields
- Implement caching for public forms
- Optimize images and assets
- Use CDN for static files
- Enable gzip compression
- Implement rate limiting

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Rate limiting
- Helmet.js security headers
- File upload restrictions

## Support

For issues and questions:
1. Check the API documentation above
2. Review error logs in browser/server console
3. Verify environment variables are set correctly
4. Ensure MongoDB is running and accessible

## License

This project is open source and available under the MIT License.