# syntax=docker/dockerfile:1

# ---------- Stage 1: build the frontend ----------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: backend production dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev

# ---------- Stage 3: runtime image ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
# built SPA served as static files by Express
COPY --from=frontend /frontend/dist ./public
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "src/server.js"]
