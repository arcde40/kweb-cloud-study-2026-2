# ---- 1단계: builder — 빌드 도구(esbuild 등 devDependencies)는 여기에만 ----
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# → dist/server.js 한 파일로 번들 (express, pg 포함)
RUN npm run build

# ---- 2단계: runtime — 결과물만 가져옴. node_modules도, 소스도 없음 ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder /app/dist/server.js ./server.js
# root(0)가 아닌 node(1000)로 실행
USER node
EXPOSE 3000
CMD ["node", "server.js"]
