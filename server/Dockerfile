# ERP API / BFF — Hostinger (separado do docker-compose do Supabase)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
# Policy CRM canônica entra com src/domain e precisa existir em dist/domain.
RUN npm run build \
  && test -f dist/domain/crmOportunidadePolicy.js \
  && test -f dist/domain/index.js

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3080
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY package.json ./
EXPOSE 3080
USER node
CMD ["node", "dist/index.js"]
