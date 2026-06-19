# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all deps (including devDependencies for build)
RUN npm ci

# Generate Prisma client (needed for TypeScript types)
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY . .

# Pre-bundle AdminJS components at build time
RUN npm run bundle:adminjs && cp .adminjs/components.bundle.js .adminjs/bundle.js

# Compile TypeScript
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:24-slim AS production
WORKDIR /app

# Install native runtime libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libdlib19.1 \
    libjpeg62-turbo \
    libblas3 \
    libopenblas0 \
    libatlas3-base \
    liblapack3 \
    openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# AdminJS ComponentLoader validates source file paths exist at startup
COPY --from=builder /app/src ./src

# Copy pre-built AdminJS bundle
COPY --from=builder /app/.adminjs ./.adminjs

# Copy pre-built Go binaries
COPY --from=builder /app/bin ./bin

# Copy Prisma schema + generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Set permissions for non-root user
RUN chown -R node:node /app/.adminjs /app/dist /app/src /app/bin

EXPOSE 80

USER node

ENV NODE_ENV=production
ENV ADMIN_JS_SKIP_BUNDLE="true"

CMD ["node", "dist/index.js"]