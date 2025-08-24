# Environment Configuration Guide

This guide covers the complete setup and configuration of the Fill.me application across different environments (development, staging, and production).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Development Setup](#development-setup)
4. [Staging Environment](#staging-environment)
5. [Production Deployment](#production-deployment)
6. [Database Configuration](#database-configuration)
7. [External Services](#external-services)
8. [Security Configuration](#security-configuration)
9. [Monitoring & Logging](#monitoring--logging)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **MongoDB**: 6.0 or higher
- **Redis**: 6.0 or higher (optional, for caching and rate limiting)
- **Docker**: 20.10 or higher (for containerized deployment)
- **Git**: Latest version

### Development Tools

- **VS Code** (recommended) with extensions:
  - TypeScript
  - ESLint
  - Prettier
  - MongoDB for VS Code
- **Postman** or **Insomnia** for API testing
- **MongoDB Compass** for database management

## Environment Variables

### Core Configuration

Create `.env` files for each environment with these variables:

#### Backend Environment Variables

```bash
# === CORE CONFIGURATION ===
NODE_ENV=development
PORT=3001
APP_NAME="Fill.me"
APP_VERSION=1.3.0

# === DATABASE ===
MONGODB_URI=mongodb://localhost:27017/fillme
MONGODB_TEST_URI=mongodb://localhost:27017/fillme_test

# === AUTHENTICATION ===
JWT_SECRET=your-super-secret-jwt-key-make-it-long-and-random
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=another-super-secret-for-refresh-tokens
REFRESH_TOKEN_EXPIRES_IN=30d

# === ENCRYPTION ===
BCRYPT_SALT_ROUNDS=12
CRYPTO_SECRET=your-crypto-secret-for-sensitive-data

# === CORS & SECURITY ===
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3005
ADMIN_EMAIL=admin@fillme.com
SUPERUSER_EMAILS=admin@fillme.com,super@fillme.com

# === FILE UPLOADS ===
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# === EMAIL CONFIGURATION ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@fillme.com
FROM_NAME="Fill.me"

# === STRIPE PAYMENT ===
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLIC_KEY=pk_test_...

# === GOOGLE OAUTH ===
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# === EXTERNAL APIS ===
GOOGLE_MAPS_API_KEY=your-google-maps-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret
OPENAI_API_KEY=your-openai-key

# === REDIS (OPTIONAL) ===
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# === RATE LIMITING ===
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL=false

# === LOGGING ===
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# === MONITORING ===
SENTRY_DSN=https://your-sentry-dsn
ANALYTICS_TRACKING_ID=GA_TRACKING_ID

# === WEBHOOKS ===
WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_TIMEOUT=30000
WEBHOOK_RETRY_ATTEMPTS=3

# === AWS S3 (OPTIONAL) ===
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket

# === CLOUDINARY (OPTIONAL) ===
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

#### Frontend Environment Variables

```bash
# === CORE CONFIGURATION ===
NEXT_PUBLIC_APP_NAME="Fill.me"
NEXT_PUBLIC_APP_VERSION=1.3.0
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# === AUTHENTICATION ===
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# === GOOGLE OAUTH ===
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id

# === STRIPE ===
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...

# === ANALYTICS ===
NEXT_PUBLIC_GA_TRACKING_ID=GA_TRACKING_ID
NEXT_PUBLIC_HOTJAR_ID=your-hotjar-id

# === FEATURES ===
NEXT_PUBLIC_ENABLE_COLLABORATION=true
NEXT_PUBLIC_ENABLE_INTEGRATIONS=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_PAYMENTS=true

# === EXTERNAL SERVICES ===
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key

# === CDN ===
NEXT_PUBLIC_CDN_URL=https://cdn.fillme.com
NEXT_PUBLIC_ASSETS_URL=https://assets.fillme.com
```

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/fill.me.git
cd fill.me

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup

```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your configuration

# Frontend environment
cd ../frontend
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

### 3. Database Setup

```bash
# Start MongoDB (if not using Docker)
mongod --dbpath /path/to/your/db

# Or using Docker
docker run --name mongodb -p 27017:27017 -d mongo:6.0

# Run migrations
cd backend
npm run migrate
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Development Tools Configuration

#### VS Code Settings (`.vscode/settings.json`)

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

#### ESLint Configuration (`.eslintrc.js`)

```javascript
module.exports = {
  extends: [
    'next/core-web-vitals',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn'
  }
};
```

## Staging Environment

### Docker Configuration

#### Backend Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3001

CMD ["npm", "start"]
```

#### Frontend Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

#### Docker Compose (development)

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: fillme-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    container_name: fillme-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    container_name: fillme-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://admin:password@mongodb:27017/fillme?authSource=admin
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build: ./frontend
    container_name: fillme-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001/api
    depends_on:
      - backend

volumes:
  mongodb_data:
  redis_data:
```

## Production Deployment

### AWS EC2 Deployment

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

#### 2. Nginx Configuration

```nginx
# /etc/nginx/sites-available/fillme.com
server {
    listen 80;
    server_name fillme.com www.fillme.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fillme.com www.fillme.com;

    ssl_certificate /etc/letsencrypt/live/fillme.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fillme.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for long-running requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # File uploads
    location /uploads {
        proxy_pass http://localhost:3001;
        client_max_body_size 50M;
    }

    # Static assets
    location /static {
        alias /var/www/fillme/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 3. SSL Certificate

```bash
# Obtain SSL certificate
sudo certbot --nginx -d fillme.com -d www.fillme.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 4. Production Docker Compose

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: fillme-mongodb-prod
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASS}
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - fillme-network

  redis:
    image: redis:7-alpine
    container_name: fillme-redis-prod
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - fillme-network

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: fillme-backend-prod
    restart: always
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASS}@mongodb:27017/fillme?authSource=admin
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    env_file:
      - .env.production
    depends_on:
      - mongodb
      - redis
    networks:
      - fillme-network
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: fillme-frontend-prod
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - backend
    networks:
      - fillme-network

networks:
  fillme-network:
    driver: bridge

volumes:
  mongodb_data:
  redis_data:
```

### Process Management

#### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'fillme-backend',
      script: 'dist/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'fillme-frontend',
      script: 'server.js',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
};
```

## Database Configuration

### MongoDB Setup

#### Production MongoDB Configuration

```javascript
// mongo-init.js
db = db.getSiblingDB('fillme');

db.createUser({
  user: 'fillme_user',
  pwd: 'secure_password',
  roles: [
    {
      role: 'readWrite',
      db: 'fillme'
    }
  ]
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.forms.createIndex({ userId: 1 });
db.forms.createIndex({ workspaceId: 1 });
db.formresponses.createIndex({ formId: 1 });
db.formresponses.createIndex({ submittedAt: -1 });
```

#### Backup Strategy

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
DB_NAME="fillme"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
mongodump --host localhost:27017 --db $DB_NAME --out $BACKUP_DIR/$DATE

# Compress backup
tar -czf $BACKUP_DIR/fillme_backup_$DATE.tar.gz -C $BACKUP_DIR $DATE

# Remove uncompressed backup
rm -rf $BACKUP_DIR/$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "fillme_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: fillme_backup_$DATE.tar.gz"
```

## External Services

### Email Configuration

#### SendGrid Setup

```bash
# Environment variables
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@fillme.com
```

#### AWS SES Setup

```bash
# Environment variables
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY=your-access-key
AWS_SES_SECRET_KEY=your-secret-key
```

### Storage Configuration

#### AWS S3 Setup

```bash
# S3 bucket policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/public/*"
    }
  ]
}
```

#### Cloudinary Setup

```bash
# Environment variables
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Security Configuration

### Firewall Setup

```bash
# UFW firewall configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### Environment Security

```bash
# Secure environment files
chmod 600 .env*
chown root:root .env*

# Secure log files
chmod 640 /var/log/fillme/*
chown fillme:adm /var/log/fillme/*
```

## Monitoring & Logging

### Application Monitoring

#### Logging Configuration

```javascript
// winston.config.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fillme-api' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

#### Health Check Endpoint

```javascript
// health.js
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    checks: {
      database: 'connected',
      redis: 'connected',
      storage: 'available'
    }
  };
  
  res.status(200).json(health);
});
```

### System Monitoring

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'fillme-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check logs
sudo tail -f /var/log/mongodb/mongod.log

# Restart MongoDB
sudo systemctl restart mongod
```

#### 2. Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER /path/to/fillme
chmod -R 755 /path/to/fillme

# Fix upload directory
sudo chown -R www-data:www-data /var/www/fillme/uploads
chmod -R 755 /var/www/fillme/uploads
```

#### 3. Memory Issues

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 4. SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew --dry-run

# Check SSL configuration
openssl s_client -connect fillme.com:443
```

### Debug Commands

```bash
# Backend debugging
npm run dev:debug

# Frontend debugging
npm run dev -- --inspect

# Database debugging
mongo --eval "db.stats()"

# Log monitoring
tail -f logs/error.log
tail -f logs/combined.log
```

### Performance Optimization

#### Node.js Optimization

```bash
# Environment variables for production
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096"
UV_THREADPOOL_SIZE=128
```

#### Database Optimization

```javascript
// MongoDB optimization
db.forms.createIndex({ userId: 1, status: 1 });
db.formresponses.createIndex({ formId: 1, submittedAt: -1 });
db.users.createIndex({ email: 1 }, { unique: true });

// Connection pooling
const mongoOptions = {
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000
};
```

This comprehensive guide should help you set up and configure Fill.me across all environments. For additional support, refer to the specific service documentation or contact the development team.