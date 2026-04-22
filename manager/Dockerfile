# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package files e instalar dependências
COPY package.json ./
RUN npm install

# Copiar todo o código fonte
COPY . .

# Build da aplicação (gera a pasta /app/dist)
# Aumentamos a RAM para evitar crashs do Vite via QEMU ARM64
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS production

WORKDIR /app

# Copiar package files e instalar apenas dependências de produção
COPY package.json ./
RUN npm install --omit=dev

# Copiar o servidor Express e pastas necessárias
COPY server.selfhosted.js ./server.js
COPY services ./services

# Copiar a pasta dist gerada no build
COPY --from=builder /app/dist ./dist

# Expor a porta do servidor
EXPOSE 3000

# Comando para iniciar o servidor em modo produção
CMD ["node", "server.js"]
