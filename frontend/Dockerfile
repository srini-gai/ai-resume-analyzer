FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY frontend/ ./frontend/
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w frontend

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80 443
