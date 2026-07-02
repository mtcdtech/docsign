# Stage 1: Build natively on host architecture (ARM64) to bypass Rosetta emulation crashes
FROM --platform=$BUILDPLATFORM node:18-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Generate client and build app
ENV DATABASE_URL="file:/app/data/dev.db"
RUN npx prisma generate
RUN npm run build

# Stage 2: Final runner container compiled for target platform (AMD64)
FROM node:18-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy generated Prisma engines and Next.js compiled static build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/package.json ./package.json

EXPOSE 3656

CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && npx next start -H 0.0.0.0 -p 3656"]
