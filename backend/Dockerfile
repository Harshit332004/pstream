FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN apk add --no-cache python3 make g++
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
