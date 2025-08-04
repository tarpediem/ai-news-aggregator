# Multi-stage Dockerfile for AI News Scraper Backend
# Base image with specific Node.js version for consistency
FROM node:20.11.1-alpine AS base

# Install security updates and required dependencies for web scraping
RUN apk update && apk upgrade && \
    apk add --no-cache \
        dumb-init \
        curl \
        ca-certificates \
        chromium \
        nss \
        freetype \
        freetype-dev \
        harfbuzz \
        ttf-freefont && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S scraper -u 1001

# Set Puppeteer to use system chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage for local development
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY --chown=scraper:nodejs . .

# Switch to non-root user
USER scraper

# Expose port
EXPOSE 8001

# Health check for development container
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start development server with crawl4ai
CMD ["dumb-init", "node", "crawl4ai-server.js"]

# Production stage
FROM base AS production

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY --chown=scraper:nodejs . .

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && \
    chown -R scraper:nodejs /app/logs

# Switch to non-root user
USER scraper

# Expose port
EXPOSE 8001

# Health check for production container
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start the application with crawl4ai
CMD ["dumb-init", "node", "crawl4ai-server.js"]