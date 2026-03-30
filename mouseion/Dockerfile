FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY mcp-server.js ./

# Seeds are mounted read-only at runtime via docker-compose volume
RUN mkdir -p /app/seeds .witness

ENV NODE_ENV=production

# MCP stdio transport — no port exposed, used by Claude Code directly
CMD ["node", "mcp-server.js"]
