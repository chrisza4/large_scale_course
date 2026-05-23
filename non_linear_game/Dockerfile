FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM deps AS build
COPY src/ ./src/
RUN bun build ./src/index.html --outdir=dist --minify

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY src/ ./src/
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "src/index.tsx"]
