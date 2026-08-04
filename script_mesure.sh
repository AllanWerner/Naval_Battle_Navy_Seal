#!/bin/bash
URL="http://localhost:4000/api/tasks"
MAX_ATTEMPTS=50   # 50 x 0.2s = 10s max

docker compose up -d

START=$(date +%s.%N)
ATTEMPT=0

until curl -sf "$URL" > /dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "❌ Timeout après ${MAX_ATTEMPTS} tentatives : le service ne répond pas sur $URL"
    exit 1
  fi
  echo -n "."
  sleep 0.2
done

END=$(date +%s.%N)
DURATION=$(awk "BEGIN {print $END - $START}")
echo ""
echo "✅ Temps jusqu'à la 1ère réponse 200 : ${DURATION}s"