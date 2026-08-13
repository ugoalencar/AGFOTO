# ============================================
# AG FOTOGRAFIA — Docker Container
# Version: 1.0.0
# Base: Node.js 20 Alpine (minimal)
# ============================================

FROM node:20-alpine

# Metadata
LABEL version="1.0.0"
LABEL description="AG Fotografia - Foto Management System"
LABEL maintainer="AG Foto"

# Set working directory
WORKDIR /app

# Install dependencies
RUN apk add --no-cache \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p \
    dados/jsons \
    dados/xlsx \
    dados/backups \
    images/temp \
    Finalizadas \
    Carros \
    logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Start application
CMD ["node", "server.js"]

# ============================================
# Usage:
#
# Build:
#   docker build -t ag-fotografia:1.0.0 .
#
# Run:
#   docker run -d \
#     -p 3000:3000 \
#     -v ag-fotografia-data:/app/dados \
#     -v ag-fotografia-images:/app/images \
#     --name ag-fotografia \
#     ag-fotografia:1.0.0
#
# Logs:
#   docker logs -f ag-fotografia
#
# Stop:
#   docker stop ag-fotografia
#
# Remove:
#   docker rm ag-fotografia
#
# ============================================
