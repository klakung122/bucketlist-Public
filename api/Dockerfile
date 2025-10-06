FROM node:20-alpine

WORKDIR /app

# ติดตั้งเฉพาะ dependencies ก่อน
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# คัดลอกโค้ดส่วนที่เหลือ
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

USER node

CMD ["npm", "start"]