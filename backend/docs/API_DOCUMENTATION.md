# Fill.me API Documentation

## Overview

Fill.me provides a comprehensive REST API for form creation, management, and analytics. This API enables developers to integrate form functionality into their applications and manage form data programmatically.

**Base URL**: `https://api.fill.me` (Production) | `http://localhost:3001/api` (Development)

**API Version**: v1

## Authentication

Fill.me API supports multiple authentication methods:

### 1. JWT Token Authentication
Used for user-specific operations:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### 2. API Key Authentication
Used for programmatic access:

```bash
X-API-Key: YOUR_API_KEY
```

### 3. Basic Authentication
For simple integrations:

```bash
Authorization: Basic base64(email:password)
```

## Rate Limiting

API endpoints are rate-limited based on your subscription plan:

- **Free**: 100 requests/hour
- **Starter**: 500 requests/hour  
- **Professional**: 2,000 requests/hour
- **Enterprise**: 10,000 requests/hour

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T12:00:00Z
```

## Error Handling

The API uses conventional HTTP response codes and returns error details in JSON format:

```json
{
  "success": false,
  "error": "validation_error",
  "message": "The provided data is invalid",
  "details": {
    "field": "email",
    "code": "invalid_format"
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## API Endpoints

### Authentication

#### Register User
```
POST /auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Login
```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

#### Logout
```
POST /auth/logout
```

#### Refresh Token
```
POST /auth/refresh
```

### Forms

#### List Forms
```
GET /forms
```

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `limit` (int): Items per page (default: 10, max: 100)
- `search` (string): Search query
- `status` (string): Form status (active, draft, archived)
- `workspaceId` (string): Filter by workspace

**Response:**
```json
{
  "success": true,
  "data": {
    "forms": [
      {
        "id": "form_123",
        "title": "Contact Form",
        "description": "Get in touch with us",
        "status": "active",
        "fields": [...],
        "settings": {...},
        "analytics": {
          "views": 150,
          "submissions": 23,
          "conversionRate": 15.3
        },
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T11:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

#### Create Form
```
POST /forms
```

**Request Body:**
```json
{
  "title": "Contact Form",
  "description": "Get in touch with us",
  "fields": [
    {
      "id": "field_1",
      "type": "text",
      "label": "Full Name",
      "placeholder": "Enter your name",
      "required": true,
      "order": 0
    },
    {
      "id": "field_2",
      "type": "email",
      "label": "Email Address",
      "placeholder": "your@email.com",
      "required": true,
      "order": 1
    }
  ],
  "settings": {
    "allowMultiple": false,
    "requireAuth": false,
    "collectIP": true
  },
  "customization": {
    "theme": "modern",
    "colors": {
      "primary": "#3B82F6",
      "background": "#FFFFFF"
    }
  }
}
```

#### Get Form
```
GET /forms/{formId}
```

#### Update Form
```
PUT /forms/{formId}
```

#### Delete Form
```
DELETE /forms/{formId}
```

#### Duplicate Form
```
POST /forms/{formId}/duplicate
```

#### Publish Form
```
POST /forms/{formId}/publish
```

#### Archive Form
```
POST /forms/{formId}/archive
```

### Form Responses

#### List Responses
```
GET /forms/{formId}/responses
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `startDate`, `endDate`: Date range filter
- `search`: Search in response data
- `export`: Export format (csv, excel, pdf)

**Response:**
```json
{
  "success": true,
  "data": {
    "responses": [
      {
        "id": "response_123",
        "formId": "form_123",
        "data": {
          "field_1": "John Doe",
          "field_2": "john@example.com"
        },
        "metadata": {
          "ip": "192.168.1.1",
          "userAgent": "Mozilla/5.0...",
          "location": {
            "country": "US",
            "city": "New York"
          }
        },
        "submittedAt": "2024-01-15T12:00:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

#### Submit Response (Public)
```
POST /public/forms/{formId}/submit
```

**Request Body:**
```json
{
  "data": {
    "field_1": "John Doe",
    "field_2": "john@example.com"
  },
  "metadata": {
    "source": "website",
    "referrer": "https://google.com"
  }
}
```

#### Get Response
```
GET /responses/{responseId}
```

#### Update Response
```
PUT /responses/{responseId}
```

#### Delete Response
```
DELETE /responses/{responseId}
```

### Templates

#### List Templates
```
GET /templates
```

**Query Parameters:**
- `category`: Template category
- `search`: Search query
- `featured`: Show featured templates only

#### Get Template
```
GET /templates/{templateId}
```

#### Create Form from Template
```
POST /templates/{templateId}/create-form
```

#### Create Custom Template
```
POST /templates
```

### Workspaces

#### List Workspaces
```
GET /workspaces
```

#### Create Workspace
```
POST /workspaces
```

**Request Body:**
```json
{
  "name": "Marketing Team",
  "description": "Forms for marketing campaigns",
  "settings": {
    "isPublic": false,
    "allowInvitations": true,
    "defaultRole": "editor"
  }
}
```

#### Get Workspace
```
GET /workspaces/{workspaceId}
```

#### Update Workspace
```
PUT /workspaces/{workspaceId}
```

#### Delete Workspace
```
DELETE /workspaces/{workspaceId}
```

#### Invite Member
```
POST /workspaces/{workspaceId}/invite
```

**Request Body:**
```json
{
  "email": "colleague@company.com",
  "role": "editor"
}
```

#### List Members
```
GET /workspaces/{workspaceId}/members
```

#### Update Member Role
```
PUT /workspaces/{workspaceId}/members/{userId}
```

#### Remove Member
```
DELETE /workspaces/{workspaceId}/members/{userId}
```

#### Get Workspace Activity
```
GET /workspaces/{workspaceId}/activity
```

### Analytics

#### Get Form Analytics
```
GET /forms/{formId}/analytics
```

**Query Parameters:**
- `timeRange`: 7d, 30d, 90d, 1y
- `metrics`: Comma-separated list of metrics

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalViews": 1250,
      "totalSubmissions": 189,
      "conversionRate": 15.12,
      "averageTime": 120
    },
    "timeline": [
      {
        "date": "2024-01-15",
        "views": 45,
        "submissions": 7,
        "conversionRate": 15.6
      }
    ],
    "devices": {
      "desktop": 65.2,
      "mobile": 31.4,
      "tablet": 3.4
    },
    "locations": [
      {
        "country": "United States",
        "percentage": 45.2
      }
    ]
  }
}
```

#### Get Advanced Analytics
```
GET /advanced-analytics
```

#### Export Analytics
```
GET /forms/{formId}/analytics/export
```

### Integrations

#### List Integrations
```
GET /integrations
```

#### Create Integration
```
POST /integrations
```

**Request Body:**
```json
{
  "type": "webhook",
  "name": "Slack Notifications",
  "formId": "form_123",
  "config": {
    "url": "https://hooks.slack.com/...",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
```

#### Update Integration
```
PUT /integrations/{integrationId}
```

#### Delete Integration
```
DELETE /integrations/{integrationId}
```

#### Test Integration
```
POST /integrations/{integrationId}/test
```

### API Keys

#### List API Keys
```
GET /api-keys
```

#### Create API Key
```
POST /api-keys
```

**Request Body:**
```json
{
  "name": "Production API",
  "permissions": ["read", "write"],
  "rateLimit": {
    "requestsPerMinute": 60,
    "requestsPerHour": 1000,
    "requestsPerDay": 10000
  }
}
```

#### Revoke API Key
```
DELETE /api-keys/{keyId}
```

### Admin (Admin Only)

#### Platform Overview
```
GET /admin/overview
```

#### User Analytics
```
GET /admin/users
```

#### System Metrics
```
GET /admin/system
```

#### Export Metrics
```
GET /admin/export/metrics
```

## Webhooks

Fill.me can send webhook notifications when events occur:

### Events
- `form.submitted` - New form submission
- `form.created` - Form created
- `form.updated` - Form updated
- `form.deleted` - Form deleted
- `user.registered` - New user registration

### Webhook Payload
```json
{
  "event": "form.submitted",
  "timestamp": "2024-01-15T12:00:00Z",
  "data": {
    "form": {
      "id": "form_123",
      "title": "Contact Form"
    },
    "response": {
      "id": "response_456",
      "data": {...},
      "submittedAt": "2024-01-15T12:00:00Z"
    }
  },
  "metadata": {
    "source": "api",
    "version": "1.0"
  }
}
```

### Webhook Security
Webhooks include an `X-Fillme-Signature` header for verification:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

## SDKs and Libraries

### JavaScript/Node.js
```bash
npm install @fillme/js-sdk
```

```javascript
import FillMe from '@fillme/js-sdk';

const client = new FillMe({
  apiKey: 'your-api-key',
  baseURL: 'https://api.fill.me'
});

// Create a form
const form = await client.forms.create({
  title: 'Contact Form',
  fields: [...]
});

// Get responses
const responses = await client.forms.getResponses('form_123');
```

### Python
```bash
pip install fillme-python
```

```python
from fillme import FillMe

client = FillMe(api_key='your-api-key')

# Create form
form = client.forms.create({
    'title': 'Contact Form',
    'fields': [...]
})

# Get analytics
analytics = client.analytics.get_form_analytics('form_123')
```

## Examples

### Create a Contact Form
```bash
curl -X POST https://api.fill.me/forms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Contact Us",
    "fields": [
      {
        "type": "text",
        "label": "Name",
        "required": true
      },
      {
        "type": "email", 
        "label": "Email",
        "required": true
      },
      {
        "type": "textarea",
        "label": "Message",
        "required": true
      }
    ]
  }'
```

### Submit a Response
```bash
curl -X POST https://api.fill.me/public/forms/form_123/submit \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "message": "Hello world!"
    }
  }'
```

### Get Form Analytics
```bash
curl -X GET "https://api.fill.me/forms/form_123/analytics?timeRange=30d" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Changelog

### v1.3.0 (Latest)
- Added workspace collaboration features
- Enhanced form builder with conditional logic
- New admin dashboard endpoints
- Improved rate limiting system
- Added real-time collaboration APIs

### v1.2.0
- Added integration system
- Webhook support
- Advanced analytics
- Template management
- API key authentication

### v1.1.0
- Form customization options
- Enhanced field types
- Basic analytics
- Export functionality

### v1.0.0
- Initial API release
- Basic form CRUD operations
- User authentication
- Form submissions

## Support

- **Documentation**: https://docs.fill.me
- **Status Page**: https://status.fill.me
- **Support Email**: support@fill.me
- **Community Forum**: https://community.fill.me

## Terms of Service

By using the Fill.me API, you agree to our [Terms of Service](https://fill.me/terms) and [Privacy Policy](https://fill.me/privacy).