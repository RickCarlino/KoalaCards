# Build Stage
FROM node:21-alpine AS builder

ENV NODE_ENV production
# Be sure to keep these up to date from time to time. RC.
ARG AUTHORIZED_EMAILS
ARG EMAIL_FROM
ARG EMAIL_SERVER_HOST
ARG EMAIL_SERVER_PASSWORD
ARG EMAIL_SERVER_PORT
ARG EMAIL_SERVER_USER
ARG GCP_JSON_CREDS
ARG GCS_BUCKET_NAME
ARG NEXTAUTH_URL
ARG OPENAI_API_KEY
ARG PORT
ARG POSTGRES_URI

WORKDIR /app
COPY . .
RUN npm install && \
    npx prisma generate && \
    npm run build && \
    rm -rf node_modules/.cache

# Production Stage
FROM node:21-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# Set Environment Variable for Production
EXPOSE 3000

# Command to start the application
CMD ["npm", "start"]
