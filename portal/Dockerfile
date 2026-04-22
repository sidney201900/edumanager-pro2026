# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.selfhosted.js ./server.js 
COPY services ./services
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "server.js"]
