#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ ! -f "$ROOT_DIR/.env" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo "Created .env from .env.example"
  else
    echo "Missing .env.example. Create .env manually." >&2
    exit 1
  fi
fi

cd "$ROOT_DIR/backend"

docker-compose up -d db

docker-compose up -d --build backend

docker-compose exec backend alembic upgrade head

echo "Backend is running at http://127.0.0.1:8000"
