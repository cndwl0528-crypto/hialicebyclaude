#!/bin/bash

#############################################################################
# HiAlice Deployment Script
#
# Usage: bash scripts/deploy.sh [environment]
# Example: bash scripts/deploy.sh production
#
# This script:
# 1. Validates environment
# 2. Builds the frontend
# 3. Runs database migrations
# 4. Starts the backend server
# 5. Performs health checks
#############################################################################

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment
ENVIRONMENT=${1:-development}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

#############################################################################
# Utility Functions
#############################################################################

log_info() {
  echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
  echo -e "${GREEN}✓ ${1}${NC}"
}

log_warn() {
  echo -e "${YELLOW}⚠ ${1}${NC}"
}

log_error() {
  echo -e "${RED}✗ ${1}${NC}"
}

check_command() {
  if ! command -v $1 &> /dev/null; then
    log_error "$1 is not installed"
    exit 1
  fi
}

#############################################################################
# Pre-flight Checks
#############################################################################

log_info "Starting HiAlice deployment for environment: $ENVIRONMENT"

# Check required commands
log_info "Checking required dependencies..."
check_command "node"
check_command "npm"
check_command "git"

log_success "All dependencies found"

# Check environment file
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
  log_error ".env.local not found. Copy .env.example to .env.local and fill in values."
  exit 1
fi

log_success "Environment file found"

# Load environment variables
set -a
source "$PROJECT_ROOT/.env.local"
set +a

#############################################################################
# Build Frontend
#############################################################################

log_info "Building frontend..."

cd "$FRONTEND_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  log_info "Installing frontend dependencies..."
  npm ci
fi

# Build Next.js application
npm run build

if [ $? -eq 0 ]; then
  log_success "Frontend build completed successfully"
else
  log_error "Frontend build failed"
  exit 1
fi

#############################################################################
# Database Migrations (Placeholder)
#############################################################################

log_info "Running database migrations..."

# This is a placeholder - actual implementation depends on your migration tool
# Examples:
# - Supabase migrations (supabase db push)
# - Knex migrations (npm run migrate)
# - Prisma migrations (npx prisma migrate deploy)

if [ "$ENVIRONMENT" = "production" ]; then
  log_warn "In production, ensure database migrations are run separately"
else
  log_info "Skipping migrations in development (configure as needed)"
fi

log_success "Database migration check completed"

#############################################################################
# Install Backend Dependencies
#############################################################################

log_info "Installing backend dependencies..."

cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
  npm ci
else
  # Update in production
  npm ci
fi

log_success "Backend dependencies installed"

#############################################################################
# Start Backend Server
#############################################################################

log_info "Starting backend server..."

# Check if port is available
PORT=${PORT:-3001}

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  log_warn "Port $PORT is already in use. Stopping existing process..."
  kill $(lsof -t -i:$PORT) 2>/dev/null || true
  sleep 2
fi

# Start the server
export NODE_ENV=$ENVIRONMENT

if [ "$ENVIRONMENT" = "production" ]; then
  npm start &
else
  npm run dev &
fi

SERVER_PID=$!
log_info "Backend server started with PID $SERVER_PID"

# Wait for server to be ready
MAX_WAIT=60
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -f http://localhost:$PORT/health 2>/dev/null; then
    log_success "Server is healthy and responding"
    break
  fi

  if ! kill -0 $SERVER_PID 2>/dev/null; then
    log_error "Server process died unexpectedly"
    exit 1
  fi

  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  log_error "Server health check timed out after ${MAX_WAIT}s"
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

#############################################################################
# Health Verification
#############################################################################

log_info "Verifying application health..."

# Check API endpoint
if ! curl -f http://localhost:$PORT/api 2>/dev/null; then
  log_warn "API endpoint returned non-success status"
fi

# Check frontend (if serving static files)
if ! curl -f http://localhost:$PORT 2>/dev/null | grep -q "HiAlice"; then
  log_warn "Frontend check did not find expected content"
fi

#############################################################################
# Success Summary
#############################################################################

log_success "============================================"
log_success "Deployment completed successfully!"
log_success "============================================"
log_success "Environment: $ENVIRONMENT"
log_success "Server running on: http://localhost:$PORT"
log_success "Server PID: $SERVER_PID"

# Display next steps
echo ""
log_info "Next steps:"
echo "  • Access the application at http://localhost:$PORT"
echo "  • Check logs with: tail -f /path/to/logs"
echo "  • To stop the server: kill $SERVER_PID"

if [ "$ENVIRONMENT" = "production" ]; then
  echo "  • Remember to use a process manager (PM2, Systemd, etc.) for production"
fi

echo ""
log_success "HiAlice is ready! 📚"
