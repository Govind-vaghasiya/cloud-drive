# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install ffmpeg for video thumbnail processing in Alpine
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Create persistent storage folders
RUN mkdir -p /app/data/storage/files /app/data/storage/temp /app/data/storage/thumbnails

EXPOSE 5000

CMD ["node", "dist/index.js"]

