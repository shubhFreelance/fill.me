# Youform Clone MVP - Testing Checklist

## Pre-Testing Setup

### 1. Environment Setup
- [ ] Node.js 18+ installed
- [ ] MongoDB running (local or Atlas connection)
- [ ] Dependencies installed (`npm install` in both frontend and backend)
- [ ] Environment files configured (`.env` in backend, `.env.local` in frontend)
- [ ] Upload directory created

### 2. Start Development Servers
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

Expected outputs:
- Backend: Server running on port 3001
- Frontend: Next.js dev server on port 3000
- MongoDB connection confirmed

## Core Feature Testing

### 1. Authentication System ✅
**Test Scenarios:**

- [ ] **User Registration**
  - Navigate to: `http://localhost:3000/auth/signup`
  - Fill form with valid data
  - Verify successful registration and redirect to dashboard
  - Check JWT token in browser storage

- [ ] **User Login**
  - Navigate to: `http://localhost:3000/auth/login`
  - Use registered credentials
  - Verify successful login and redirect to dashboard
  - Test invalid credentials (should show error)

- [ ] **Dashboard Access**
  - Verify authenticated user can access dashboard
  - Test protected routes redirect unauthenticated users to login

- [ ] **User Logout**
  - Test logout functionality
  - Verify redirect to homepage and token removal

### 2. Form Builder Interface ✅
**Test Scenarios:**

- [ ] **Form Creation**
  - Navigate to: `http://localhost:3000/forms/create`
  - Add form title and description
  - Add various field types (text, email, dropdown, etc.)
  - Test field property editing (labels, required fields, options)
  - Save form and verify success

- [ ] **Form Editing**
  - Edit an existing form
  - Add/remove/reorder fields
  - Update form settings
  - Verify changes are saved

- [ ] **Field Types Testing**
  - [ ] Single-line text field
  - [ ] Multi-line text field (textarea)
  - [ ] Email field
  - [ ] Dropdown with custom options
  - [ ] Radio buttons with multiple options
  - [ ] Checkboxes with multiple options
  - [ ] Date picker
  - [ ] File upload

### 3. Form Sharing & Public Access ✅
**Test Scenarios:**

- [ ] **Public Form Access**
  - Get public URL from dashboard
  - Open in incognito/new browser
  - Verify form renders correctly with customization
  - Test form fields display properly

- [ ] **Form Submission**
  - Fill out public form completely
  - Submit with valid data
  - Verify success message appears
  - Test required field validation
  - Test email format validation

- [ ] **SEO & Meta Tags**
  - Check page title in browser tab
  - Verify meta description
  - Test social media sharing (Open Graph)

### 4. Response Collection & Analytics ✅
**Test Scenarios:**

- [ ] **Response Dashboard**
  - Navigate to form responses page
  - Verify submitted responses appear
  - Check response details display correctly
  - Test pagination if multiple responses

- [ ] **Analytics Display**
  - Verify view count increases on form access
  - Check submission count after form submissions
  - Verify conversion rate calculation
  - Test analytics charts/metrics

- [ ] **CSV Export**
  - Export responses to CSV
  - Verify file downloads correctly
  - Check CSV contains all form fields and responses
  - Test with multiple response types

### 5. Form Customization ⚠️
**Test Scenarios:**

- [ ] **Color Customization**
  - Change primary color in form builder
  - Verify color applies to public form
  - Test buttons, links, and accents

- [ ] **Font Family**
  - Change font family setting
  - Verify font applies throughout public form
  - Test readability and consistency

- [ ] **Logo Upload** (Basic Implementation)
  - Upload logo in form customization
  - Verify logo displays on public form
  - Test logo positioning and sizing

### 6. Iframe Embedding ✅
**Test Scenarios:**

- [ ] **Embed Code Generation**
  - Copy embed code from form dashboard
  - Verify iframe code includes correct URL
  - Test embed code in external HTML page

- [ ] **Embedded Form Functionality**
  - Navigate to: `http://localhost:3000/embed/[publicUrl]`
  - Verify form works within iframe
  - Test form submissions through embed
  - Check responsive design in iframe

## API Testing

### 1. Authentication Endpoints
```bash
# Test user registration
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}'

# Test user login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 2. Form Management Endpoints
```bash
# Get user forms (requires JWT token)
curl -X GET http://localhost:3001/api/forms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create new form (requires JWT token)
curl -X POST http://localhost:3001/api/forms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Form","fields":[{"type":"text","label":"Name","required":true}]}'
```

### 3. Public Form Endpoints
```bash
# Get public form
curl -X GET http://localhost:3001/api/public/forms/PUBLIC_URL

# Submit form response
curl -X POST http://localhost:3001/api/public/forms/PUBLIC_URL/submit \
  -H "Content-Type: application/json" \
  -d '{"responses":{"field_id":"Test Response"}}'
```

## Performance Testing

### 1. Load Testing
- [ ] Test multiple concurrent form submissions
- [ ] Verify database performance with many responses
- [ ] Check memory usage during heavy load

### 2. Response Times
- [ ] Form loading speed (< 2 seconds)
- [ ] Form submission response time (< 1 second)
- [ ] Dashboard loading with many forms (< 3 seconds)

## Security Testing

### 1. Authentication Security
- [ ] JWT token expiration works correctly
- [ ] Protected routes reject invalid tokens
- [ ] Password hashing verification

### 2. Input Validation
- [ ] SQL injection protection (MongoDB injection)
- [ ] XSS prevention in form submissions
- [ ] File upload restrictions (type, size)
- [ ] Rate limiting on API endpoints

### 3. CORS and Headers
- [ ] CORS configuration working
- [ ] Security headers present (Helmet.js)
- [ ] CSP headers for iframe embedding

## Cross-Browser Testing

### 1. Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 2. Mobile Browsers
- [ ] Mobile Chrome
- [ ] Mobile Safari
- [ ] Responsive design functionality

## Error Handling Testing

### 1. Network Errors
- [ ] Form submission with network failure
- [ ] API timeout handling
- [ ] Database connection failure

### 2. User Input Errors
- [ ] Invalid email format
- [ ] Missing required fields
- [ ] File upload size limits
- [ ] Special characters in form data

## Deployment Testing

### 1. Production Build
```bash
# Frontend production build
cd frontend && npm run build

# Backend production setup
cd backend && NODE_ENV=production npm start
```

### 2. Environment Variables
- [ ] Production environment variables set
- [ ] MongoDB connection string updated
- [ ] JWT secrets configured
- [ ] CORS origins configured for production

## Known Limitations & Future Enhancements

### Current MVP Limitations:
1. **File Upload**: Basic implementation, not cloud storage
2. **Advanced Validation**: Limited regex validation
3. **Themes**: Basic color/font customization only
4. **Analytics**: Basic metrics only
5. **Collaboration**: Single user per form

### Recommended Enhancements:
1. **Cloud Storage**: AWS S3/Cloudinary for file uploads
2. **Advanced Form Logic**: Conditional fields, multi-step forms
3. **Team Collaboration**: Share forms with team members
4. **Advanced Analytics**: Detailed charts, export formats
5. **Payment Integration**: Stripe for paid forms
6. **White-label**: Custom branding options

## Bug Report Template

When reporting issues, include:
```
**Environment:**
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari/Edge + version]
- Node.js version: [version]
- MongoDB version: [version]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Logs:**
[If applicable]
```

## Success Criteria

✅ **MVP Complete When:**
- [ ] All authentication flows working
- [ ] Form builder creates functional forms
- [ ] Public forms collect responses correctly
- [ ] Response dashboard displays data
- [ ] CSV export works
- [ ] Basic customization applies
- [ ] Iframe embedding functional
- [ ] API endpoints documented and working
- [ ] Setup documentation complete

## Quick Test Commands

```bash
# Test backend health
curl http://localhost:3001/health

# Quick form creation test
# 1. Register/login at http://localhost:3000
# 2. Create form at http://localhost:3000/forms/create
# 3. Submit response at public URL
# 4. Check responses at http://localhost:3000/forms/[id]/responses

# Database check
# Connect to MongoDB and verify collections: users, forms, formresponses
```

This comprehensive testing ensures the Youform Clone MVP meets all requirements and is ready for production deployment.