# Fill.me - Form Builder MVP

> A modern, full-stack form builder application that allows users to create, customize, share, and collect responses from custom forms.

[![GitHub](https://img.shields.io/github/license/yourusername/fill.me)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-blue.svg)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7+-green.svg)](https://mongodb.com/)

## 🚀 Features

- **🔐 Authentication**: Secure JWT-based user authentication with signup/login
- **🎨 Form Builder**: Intuitive drag-and-drop interface with 8 field types
- **🔗 Form Sharing**: Public URLs and iframe embeds for easy distribution
- **📊 Response Collection**: Real-time response tracking and management
- **📈 Analytics**: View counts, submission rates, and conversion metrics
- **🎯 Customization**: Brand colors, fonts, and logo upload
- **📁 File Uploads**: Support for file uploads in form responses
- **📋 Export**: CSV export of responses with file download links
- **📱 Responsive**: Mobile-friendly design for all devices
- **⚡ Performance**: Server-side rendering for optimal SEO

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (React Framework)
- TypeScript
- Tailwind CSS
- Axios (API calls)
- React Hot Toast (Notifications)

**Backend:**
- Node.js + Express.js
- MongoDB with Mongoose
- JWT Authentication
- Multer (File uploads)
- Express Rate Limiting
- CORS configured

**Development:**
- Nodemon (Auto-restart)
- ESLint + Prettier
- Environment-based configuration

## 📚 Project Structure

```
fill.me/
├── frontend/              # Next.js React application
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # Reusable components
│   │   ├── lib/             # Utilities & context
│   │   └── types/           # TypeScript types
│   ├── public/            # Static assets
│   └── package.json
├── backend/               # Express.js API server
│   ├── src/
│   │   ├── models/          # MongoDB schemas
│   │   ├── routes/          # API endpoints
│   │   ├── middleware/      # Auth & validation
│   │   └── config/          # Database config
│   └── package.json
├── uploads/               # File storage directory
└── README.md
```

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/fill.me.git
   cd fill.me
   ```

2. **Install dependencies:**
   ```bash
   # Install frontend dependencies
   cd frontend && npm install
   
   # Install backend dependencies
   cd ../backend && npm install
   ```

3. **Environment Setup:**
   
   **Backend (.env):**
   ```bash
   cp backend/.env.example backend/.env
   ```
   
   Update `backend/.env` with your values:
   ```env
   MONGODB_URI=mongodb://localhost:27017/fill-me
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRES_IN=7d
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3005
   UPLOAD_DIR=../uploads
   MAX_FILE_SIZE=5242880
   ```
   
   **Frontend (.env.local):**
   ```bash
   cp frontend/.env.example frontend/.env.local
   ```
   
   Update `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_FRONTEND_URL=http://localhost:3005
   NEXTAUTH_URL=http://localhost:3005
   NEXTAUTH_SECRET=your-nextauth-secret-key
   ```

4. **Start Development Servers:**
   
   **Terminal 1 - Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   
   **Terminal 2 - Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

5. **Access the Application:**
   - Frontend: http://localhost:3005
   - Backend API: http://localhost:3001
   - API Health Check: http://localhost:3001/health

## 📡 API Documentation

### Authentication Endpoints
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token

### Form Management
- `GET /api/forms` - Get user's forms (paginated)
- `POST /api/forms` - Create new form
- `GET /api/forms/:id` - Get form details
- `PUT /api/forms/:id` - Update form
- `DELETE /api/forms/:id` - Delete form (soft delete)
- `POST /api/forms/:id/upload-logo` - Upload form logo
- `POST /api/forms/:id/sync-analytics` - Sync form analytics

### Public Form Access
- `GET /api/public/forms/:publicUrl` - Get public form (increments views)
- `POST /api/public/forms/:publicUrl/submit` - Submit form response
- `GET /api/public/forms/:publicUrl/preview` - Preview form (no view increment)
- `GET /api/public/forms/:publicUrl/embed` - Get embed code

### Response Management
- `GET /api/responses/forms/:formId` - Get form responses (paginated)
- `GET /api/responses/forms/:formId/export` - Export responses to CSV
- `GET /api/responses/forms/:formId/analytics` - Get response analytics
- `GET /api/responses/:responseId` - Get single response
- `DELETE /api/responses/:responseId` - Delete response

## 📝 Field Types Supported

1. **Text** - Single line text input
2. **Textarea** - Multi-line text input
3. **Email** - Email validation input
4. **Dropdown** - Select from predefined options
5. **Radio** - Single choice from options
6. **Checkbox** - Multiple choice from options
7. **Date** - Date picker
8. **File** - File upload (images, documents)

## 🚀 Deployment

### Environment Variables

**Backend Required:**
```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=https://your-domain.com
```

**Frontend Required:**
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_FRONTEND_URL=https://your-domain.com
```

### Production Deployment

**Backend (Node.js):**
- Deploy to services like Railway, Render, or DigitalOcean
- Set `NODE_ENV=production`
- Configure MongoDB Atlas for database
- Set up file storage (AWS S3, Cloudinary, etc.)

**Frontend (Next.js):**
- Deploy to Vercel, Netlify, or similar
- Build command: `npm run build`
- Output directory: `.next`

## 🛠️ Development

### Key Features
- **Hot Reload**: Both frontend and backend support hot reloading
- **CORS**: Configured for cross-origin development
- **File Uploads**: Handled via Multer with size limits
- **Authentication**: JWT-based with HTTP-only cookies
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Server-side validation for all inputs
- **Analytics**: Real-time view and submission tracking

### Database Schema
- **Users**: Authentication and profile data
- **Forms**: Form structure, fields, and customization
- **FormResponses**: User submissions with validation
- **Analytics**: Embedded in forms for performance

### Security Features
- Rate limiting on form submissions
- Input validation and sanitization
- File type and size restrictions
- CORS configuration
- Environment-based configuration

## 📚 Additional Documentation

- [Development Guide](DEVELOPMENT.md) - Detailed development setup and workflows
- [Testing Guide](TESTING.md) - Testing procedures and scenarios

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/fill.me/issues) on GitHub.

---

**Built with ❤️ using Next.js, Express.js, and MongoDB**