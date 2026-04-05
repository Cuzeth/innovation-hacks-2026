FROM node:20-slim AS builder

WORKDIR /app
RUN npm install -g bun

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
ENV NEXT_PUBLIC_API_URL=""
RUN bun run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
