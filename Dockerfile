FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

FROM deps AS test
COPY server server
COPY web web
CMD ["npm", "test"]

FROM deps AS builder
COPY server server
COPY web web
RUN npm run build

FROM deps AS app
COPY --from=builder /app/web/dist /app/web/dist
COPY --from=builder /app/server/dist /app/server/dist
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
