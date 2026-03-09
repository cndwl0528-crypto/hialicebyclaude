# HiAlice Phase 5: Beta Readiness & Deployment Guide

**Status**: Phase 5 Complete ✓
**Date**: March 9, 2026
**Version**: 1.0.0

---

## Overview

Phase 5 deliverables include error handling, offline support, PWA functionality, and production-ready Docker configuration. All components follow child-friendly design patterns and the HiAlice color system.

---

## Created Files & Components

### 1. Frontend Components

#### ErrorBoundary.js
**Location**: `/frontend/src/components/ErrorBoundary.js`

A class component that catches rendering errors and displays a friendly error UI:
- Catches and logs errors with `componentDidCatch`
- Shows child-friendly error message ("Oops! Something went wrong")
- "Try Again" button resets error state
- Development mode shows error details in collapsible section
- Uses HiAlice branding and color system

**Usage**:
```javascript
import ErrorBoundary from '@/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

#### LoadingSkeleton.js
**Location**: `/frontend/src/components/LoadingSkeleton.js`

Reusable skeleton loading components with shimmer animation:
- `SkeletonCard` — Card placeholder with image and text
- `SkeletonText` — Text line placeholder (configurable lines)
- `SkeletonAvatar` — Circle avatar (sm/md/lg/xl sizes)
- `SkeletonChat` — Chat message placeholder (alice/student variants)
- `PageLoader` — Full-page loading with HiAlice branding
- `SkeletonGrid` — Grid of card skeletons

**Features**:
- CSS-based shimmer animation (no JavaScript animation)
- Uses Tailwind CSS gradient animation
- Responsive to all screen sizes
- Child-friendly visual design

**Usage**:
```javascript
import { SkeletonCard, PageLoader } from '@/components/LoadingSkeleton';

export default function MyComponent() {
  return isLoading ? <PageLoader /> : <Content />;
}
```

#### OfflineBanner.js
**Location**: `/frontend/src/components/OfflineBanner.js`

Automatic offline detection banner:
- Uses `navigator.onLine` and `online`/`offline` events
- Shows yellow banner at top when offline
- Friendly message for kids
- Auto-hides when connection restored
- No hydration issues (mounted check)

**Features**:
- Uses standard browser APIs (no external dependencies)
- Emoji icon indicator (📡)
- Auto-recovers on reconnect
- Mobile-friendly positioning

---

### 2. PWA & Offline Support

#### Public Manifest
**Location**: `/frontend/public/manifest.json`

Web App Manifest for PWA functionality:
- App name: "HiAlice - Reading Companion"
- Display mode: standalone (fullscreen on mobile)
- Theme color: #4A90D9
- Icons in SVG format (192x192, 512x512)
- Includes app shortcuts for quick actions:
  - Start Reading (`/books`)
  - My Vocabulary (`/vocabulary`)

**Capabilities**:
- Installable on home screen (iOS/Android)
- Supports custom splash screens
- Maskable icons for adaptive displays
- Two app shortcuts for quick access

#### Service Worker
**Location**: `/frontend/public/sw.js`

Complete service worker with caching strategies:

**Install Phase**:
- Caches static assets on first load
- Gracefully handles cache failures

**Activate Phase**:
- Cleans up old cache versions
- Activates immediately

**Fetch Phase - Smart Caching**:
- **API calls** (Network-first): Try network, fall back to cache
- **Static assets** (Cache-first): Check cache, fall back to network
- **Navigation** (Network-first with offline fallback): Go to offline page if needed
- **Offline fallback**: Serves basic HTML when both network and cache fail

**Features**:
- Ignore non-GET requests
- Automatic cache busting
- Fallback HTML for offline pages
- Detailed console logging
- Message handling for skip-waiting

#### Offline Page
**Location**: `/frontend/src/app/offline/page.js`

Friendly offline fallback page:
- "You're Offline" message with 📡 emoji
- Explains what user can do offline
- Auto-redirects when reconnected
- Shows status updates in real-time
- Links back to home

**Content**:
- What can be done offline (vocab, past sessions, progress)
- Try Again button with connectivity check
- Friendly tips for kids

---

### 3. Configuration Files

#### next.config.js (Updated)
**Location**: `/frontend/next.config.js`

Enhanced Next.js configuration:

**PWA Headers**:
- Manifest.json content-type
- Service worker headers with cache control
- Service-Worker-Allowed scope

**Security Headers**:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection enabled

**Performance Optimizations**:
- Image optimization enabled
- AVIF and WebP format support
- SWC minification
- Package import optimization

#### layout.js (Updated)
**Location**: `/frontend/src/app/layout.js`

Enhanced root layout with:
- ErrorBoundary wrapper
- OfflineBanner component
- Service worker registration
- PWA meta tags:
  - apple-mobile-web-app-capable
  - apple-mobile-web-app-status-bar-style
  - manifest.json link
  - SVG favicon

---

### 4. Docker & Deployment

#### Dockerfile
**Location**: `/Dockerfile`

Multi-stage Docker build:

**Stage 1: Frontend Builder**
- Node 20 Alpine
- Builds Next.js application
- Outputs to `.next` directory

**Stage 2: Production Backend**
- Node 20 Alpine (lightweight)
- Copies backend source
- Installs production dependencies only
- Copies built frontend
- Health check enabled
- Uses dumb-init for proper signal handling
- Exposes port 3001

**Features**:
- Multi-stage reduces final image size
- Health check with HTTP endpoint
- Proper signal handling
- Production-optimized

#### docker-compose.yml
**Location**: `/docker-compose.yml`

Complete Docker Compose setup with two services:

**Service 1: hialice-app** (Frontend + Backend)
- Builds from Dockerfile
- Port 3001
- Environment variables from .env
- Depends on PostgreSQL health
- Network: hialice-network
- Health checks enabled
- Auto-restart policy

**Service 2: postgres** (Development Database)
- PostgreSQL 16 Alpine
- Port 5432
- Volume persistence
- Health check
- Environment configured via .env

**Features**:
- Easy local development setup
- Production-ready networking
- Volume persistence for data
- Health checks for both services

#### .env.example
**Location**: `/.env.example`

Complete environment configuration template with sections:

**Backend**:
- NODE_ENV, PORT, API_URL

**Frontend**:
- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

**Supabase**:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY

**Database**:
- DB_USER, DB_PASSWORD, DB_NAME
- DB_HOST, DB_PORT

**AI & Services**:
- ANTHROPIC_API_KEY
- OPENAI_API_KEY (Whisper STT)
- ELEVENLABS_API_KEY (TTS)

**Authentication**:
- JWT_SECRET, JWT_EXPIRY

**Optional Services**:
- SMTP configuration
- Logging/Monitoring
- Feature flags

#### deploy.sh
**Location**: `/scripts/deploy.sh`

Production deployment script:

**Pre-flight Checks**:
- Verify required commands (node, npm, git)
- Check .env.local exists
- Load environment variables

**Build Phase**:
- Install frontend dependencies
- Build Next.js application
- Install backend dependencies

**Database Phase**:
- Placeholder for database migrations
- Configurable for Supabase/Knex/Prisma

**Server Phase**:
- Kill existing process on port
- Start backend server
- Wait for health check (60s timeout)

**Verification Phase**:
- Health endpoint check
- API endpoint validation
- Frontend content check

**Features**:
- Color-coded output
- Error handling with exit codes
- Process PID management
- Health check validation
- Environment auto-configuration

---

## Setup & Deployment Instructions

### Local Development

1. **Copy environment template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in required values**:
   - Supabase credentials
   - Anthropic API key
   - Any speech/AI service keys

3. **Using Docker Compose** (Recommended):
   ```bash
   docker-compose up -d
   ```
   Access at `http://localhost:3001`

4. **Manual setup**:
   ```bash
   # Frontend
   cd frontend
   npm install
   npm run build

   # Backend
   cd ../backend
   npm install
   npm start
   ```

### Production Deployment

1. **Prepare environment**:
   ```bash
   cp .env.example .env.local
   # Edit with production values
   nano .env.local
   ```

2. **Using deployment script**:
   ```bash
   bash scripts/deploy.sh production
   ```

3. **Using Docker**:
   ```bash
   docker build -t hialice:latest .
   docker run -p 3001:3001 --env-file .env.local hialice:latest
   ```

4. **Process manager** (recommended for long-term):
   ```bash
   npm install -g pm2
   pm2 start backend/src/index.js --name hialice
   pm2 save
   pm2 startup
   ```

---

## Features & Capabilities

### Error Handling
- [x] React Error Boundary component
- [x] Development error details
- [x] Child-friendly error UI
- [x] Recovery button

### Offline Support
- [x] Service worker with caching
- [x] Network-first API strategy
- [x] Cache-first static strategy
- [x] Offline detection banner
- [x] Offline fallback page
- [x] Auto-reconnect detection

### PWA Features
- [x] Web App Manifest
- [x] Installable on home screen
- [x] App shortcuts
- [x] Theme colors
- [x] Splash screens (Android)
- [x] Service worker registration

### Performance
- [x] Multi-stage Docker build
- [x] Image optimization
- [x] Code minification
- [x] Health checks
- [x] Skeleton loading UI
- [x] Efficient caching strategies

### Security
- [x] Environment variable isolation
- [x] Service worker headers
- [x] XSS protection headers
- [x] Content-type validation
- [x] Production .env separation

---

## Color System Integration

All new components use the HiAlice color scheme:

- **Primary** (#4A90D9): Buttons, links, HiAlice branding
- **Background** (#F5F7FA): Page background, reduced eye strain
- **Accent** (#F39C12): Alerts, highlights, progress
- **Success** (#27AE60): Completion, positive feedback

---

## Browser Support

- **Modern browsers**: Full PWA support
- **iOS 12+**: Web app installation, offline support
- **Android 5+**: PWA installation, service worker
- **Fallback**: Non-PWA browsers still work fully

---

## Monitoring & Troubleshooting

### Health Checks

**Frontend**:
- Service worker registration in console
- PWA install prompt
- Offline banner visibility

**Backend**:
- `/health` endpoint returns 200
- Database connection verified
- API endpoints responsive

### Common Issues

1. **Service worker not registering**:
   - Check HTTPS (required for SW)
   - Verify `/sw.js` is accessible
   - Check browser console for errors

2. **Offline page not showing**:
   - Verify service worker is installed
   - Check manifest.json syntax
   - Test with Network tab disabled

3. **Docker build fails**:
   - Check Node version (need 20+)
   - Verify npm dependencies
   - Clear Docker cache: `docker system prune`

4. **Deployment script fails**:
   - Check .env.local exists
   - Verify port not in use
   - Check write permissions

---

## Next Steps (Phase 6+)

- [ ] Analytics integration
- [ ] Push notifications
- [ ] Offline data sync
- [ ] Advanced caching strategies
- [ ] Performance monitoring
- [ ] User feedback system
- [ ] A/B testing framework
- [ ] Extended PWA features

---

## File Summary

| File | Purpose | Status |
|------|---------|--------|
| ErrorBoundary.js | Error handling | ✓ Created |
| LoadingSkeleton.js | Loading states | ✓ Created |
| OfflineBanner.js | Offline detection | ✓ Created |
| manifest.json | PWA config | ✓ Created |
| sw.js | Service worker | ✓ Created |
| offline/page.js | Offline fallback | ✓ Created |
| next.config.js | Next.js config | ✓ Updated |
| layout.js | Root layout | ✓ Updated |
| Dockerfile | Container build | ✓ Created |
| docker-compose.yml | Local dev setup | ✓ Created |
| .env.example | Config template | ✓ Created |
| deploy.sh | Deployment script | ✓ Created |

---

## Validation Checklist

- [x] All components created successfully
- [x] Files use child-friendly language
- [x] HiAlice color system applied
- [x] Mobile-first responsive design
- [x] Error handling implemented
- [x] Offline support complete
- [x] PWA manifest valid
- [x] Service worker functional
- [x] Docker build multi-stage
- [x] Environment template complete
- [x] Deployment script tested
- [x] Security headers added
- [x] No sensitive data in examples

---

*HiAlice Phase 5 Deployment Guide — v1.0 | March 2026*
