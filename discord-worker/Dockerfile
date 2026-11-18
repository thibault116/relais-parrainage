FROM node:24-alpine
WORKDIR /app
COPY scripts/discord-welcome-worker.mjs ./worker.mjs
USER node
CMD ["node", "worker.mjs"]
