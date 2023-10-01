# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Production Stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Set Environment Variable for Production
ENV NODE_ENV production

EXPOSE 3000

# Command to start the application
CMD ["node_modules/.bin/next", "start"]
