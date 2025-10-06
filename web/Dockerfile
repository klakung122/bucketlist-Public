# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- run ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# คัดลอกไฟล์ที่ต้องใช้ตอนรัน
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package*.json ./

# ติดตั้งเฉพาะ prod deps สำหรับ runtime
RUN npm ci --omit=dev && npm cache clean --force

# ใช้ user ปลอดภัยกว่า root
USER node

EXPOSE 3000
CMD ["npm", "start"]