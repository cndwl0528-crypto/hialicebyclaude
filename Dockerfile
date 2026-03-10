# Multi-stage Dockerfile for HiAlice
# Stage 1: Build frontend
# Stage 2: Production backend with frontend static files

# ============================================
# Stage 1: Frontend Builder
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build Next.js app
RUN npm run build

# ============================================
# Stage 2: Production Backend
# ============================================
FROM node:20-alpine

WORKDIR /app

# Install dumb-init to handle signals properly
RUN apk add --no-cache dumb-init

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy backend source
COPY backend/ ./

# Create public directory for static files
RUN mkdir -p ./public

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/.next ./public/.next
COPY --from=frontend-builder /app/frontend/public/ ./public/

# Create a simple health check endpoint script
RUN echo '#!/bin/sh\nnode -e "require(\"https\").get(\"http://localhost:3001/health\", (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on(\"error\", () => process.exit(1))"' > /healthcheck.sh && chmod +x /healthcheck.sh

# Expose backend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init to ensure signals are properly handled
ENTRYPOINT ["dumb-init", "--"]

# Start backend server
CMD ["npm", "start"]
