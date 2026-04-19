# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "server.js"]
