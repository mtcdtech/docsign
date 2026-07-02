FROM node:18-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Default DATABASE_URL for build time
ENV DATABASE_URL="file:/app/data/dev.db"

# Force Prisma to use library engines (avoids Rosetta spawn emulation crashes on Apple Silicon)
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=library
ENV PRISMA_CLIENT_ENGINE_TYPE=library

# Generate client and build app
RUN npm run build

EXPOSE 3656

CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && npm start"]
