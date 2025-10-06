# build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback
RUN printf 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf