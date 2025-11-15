#!/bin/sh

# Wait for the database to be ready
until nc -z db 5432; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done

npm install
# Run migrations
npx prisma migrate deploy

# Start the application (defined in the `command` field in `docker-compose.yml`)
exec "$@"