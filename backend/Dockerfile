FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY backend/ ./backend/
RUN npm run build -w backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/backend/dist ./backend/dist
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
