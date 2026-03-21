FROM node:20-alpine

WORKDIR /elo-workbench/apps/elo-server

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .

EXPOSE 8001

CMD ["pnpm", "run", "dev"]
