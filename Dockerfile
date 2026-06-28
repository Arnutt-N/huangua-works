# syntax=docker/dockerfile:1.7
# Dockerfile — อบต.หัวงัว citizen-help (Next.js 16 standalone)
# multi-stage: deps -> builder -> runner (production-style, รัน local ได้)
# รัน: docker compose up --build  → http://localhost:3000

# ---- deps: ติดตั้ง dependencies ตาม lockfile ----
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- builder: คอมไพล์ Next.js (standalone) ----
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ใช้ next build ตรงๆ (ข้าม `pnpm build` ที่ต่อ verify-env ซึ่งต้องการ secret
# — verify-env gate สำหรับ CI/Vercel deploy เท่านั้น ไม่ใช่ local Docker)
RUN pnpm exec next build

# ---- runner: image เล็ก รัน standalone server ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000 HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone รวม server.js + node_modules subset ที่จำเป็น
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]