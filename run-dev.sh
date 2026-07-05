#!/bin/sh

set -eu

docker compose up \
  --build \
  --remove-orphans \
  "$@"
