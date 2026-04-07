FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
  ca-certificates \
  curl \
  git \
  tar \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server build

ENV NODE_ENV=production

CMD ["node", "artifacts/api-server/dist/index.cjs"]
