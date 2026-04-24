# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /src
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /src/dist ./dist
EXPOSE 8080
USER node
CMD ["node", "dist/index.js"]
