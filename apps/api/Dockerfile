FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY src ./src/
RUN npm install && npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/prisma.config.ts ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
