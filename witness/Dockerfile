FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html ./

RUN mkdir -p .witness

ENV NODE_ENV=production
ENV WITNESS_PORT=9000

EXPOSE 9000

CMD ["node", "server.js"]
