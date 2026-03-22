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

CMD ["pnpm", "--filter", "@workspace/worker", "start"]
