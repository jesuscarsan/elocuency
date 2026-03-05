FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    docker-cli \
    docker-cli-compose \
    curl \
    git \
    bash

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# The monorepo will be mounted here
ENTRYPOINT ["npx", "tsx", "apps/elo-cli/src/index.ts"]
