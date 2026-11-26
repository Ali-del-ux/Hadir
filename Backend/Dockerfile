# Build Stage
FROM node:20-alpine AS build

# Use non-root user
USER node
WORKDIR /home/node/app

# Copy dependency definitions
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts --no-audit --no-fund; fi

# Copy application source
COPY --chown=node:node src ./src

# Build the application
RUN npm run build

# Production Stage
FROM node:20-alpine AS production

# Set Node environment
ENV NODE_ENV=production

# Use non-root user
USER node
WORKDIR /home/node/app

# Copy only production dependencies
COPY --chown=node:node package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --ignore-scripts; else npm install --omit=dev --ignore-scripts --no-audit --no-fund; fi && npm cache clean --force

# Copy built artifacts from build stage
COPY --chown=node:node --from=build /home/node/app/dist ./dist

# Do not copy raw secrets, logs, or unnecessary files! (Ensured via .dockerignore)

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c 'wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-3000}/health/live || exit 1'

# Start the application
CMD ["node", "dist/server.js"]
