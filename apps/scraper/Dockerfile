FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

FROM base AS builder
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml* ./
COPY packages/database/package.json ./packages/database/
COPY apps/scraper/package.json ./apps/scraper/

# Install dependencies
RUN pnpm install

# Copy source files
COPY packages/database ./packages/database
COPY apps/scraper ./apps/scraper
COPY tsconfig.json ./

# Generate Prisma client
RUN pnpm --filter @train-tracker/database db:generate

# Build packages
RUN pnpm --filter @train-tracker/database build
RUN pnpm --filter @train-tracker/scraper build

FROM base AS runner
WORKDIR /app

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/apps/scraper/node_modules ./apps/scraper/node_modules
COPY --from=builder /app/apps/scraper/dist ./apps/scraper/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/apps/scraper/package.json ./apps/scraper/

WORKDIR /app/apps/scraper

CMD ["node", "dist/index.js"]
