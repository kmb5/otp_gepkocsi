# ── Build stage is not needed (no TypeScript/bundling) ──────────────
FROM node:22-alpine

# Run as non-root user for security
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source
COPY server.js ./
COPY public/ ./public/

# Switch to non-root
USER app

EXPOSE 3000

CMD ["node", "server.js"]
