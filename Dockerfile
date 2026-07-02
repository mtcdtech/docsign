FROM node:18-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Default DATABASE_URL for build time (prisma generate needs it)
ENV DATABASE_URL="file:/app/prisma/dev.db"

# Generate client and build app
RUN npm run build

EXPOSE 3656

CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && npm start"]
