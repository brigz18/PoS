FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/backend

# Install dependencies first (better layer caching)
COPY backend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# App code: backend in /app/backend, frontend in /app/frontend
# (server.js serves ../frontend relative to itself)
COPY backend/ ./
COPY frontend/ /app/frontend/

RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "server.js"]
