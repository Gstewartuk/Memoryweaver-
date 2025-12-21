FROM node:20-slim

RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libatk-bridge2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-6 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxss1 \
  libasound2 \
  libatk1.0-0 \
  libcups2 \
  libgbm1 \
  libgtk-3-0 \
  libxkbcommon0 \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --production
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
