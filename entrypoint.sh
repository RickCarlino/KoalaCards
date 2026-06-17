#!/bin/sh

set -eu

if [ "${KOALA_WAIT_FOR_DB:-1}" = "1" ]; then
  until nc -z db 5432; do
    echo "Waiting for PostgreSQL..."
    sleep 1
  done
fi

if [ "${KOALA_SYNC_DEPS:-1}" = "1" ]; then
  lock_hash="$(sha256sum package.json package-lock.json | sha256sum | awk '{ print $1 }')"
  stamp_file="node_modules/.koala-package-lock-hash"
  lock_dir="/root/.npm/.koala-install-lock"

  mkdir -p /root/.npm
  while ! mkdir "$lock_dir" 2>/dev/null; do
    echo "Waiting for npm install lock..."
    sleep 1
  done
  trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT

  installed_hash=""
  if [ -f "$stamp_file" ]; then
    installed_hash="$(cat "$stamp_file")"
  fi

  if [ "$installed_hash" != "$lock_hash" ]; then
    npm ci --prefer-offline --no-audit --fund=false
    npx prisma generate
    printf "%s" "$lock_hash" > "$stamp_file"
  fi

  rmdir "$lock_dir"
  trap - EXIT
fi

exec "$@"
