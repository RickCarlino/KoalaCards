#!/bin/sh

set -eu

docker compose -f docker-compose.yml -f docker-compose.dev.yml up \
  --build \
  --force-recreate \
  --remove-orphans \
  "$@"
