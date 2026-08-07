#!/usr/bin/env bash
set -euo pipefail

# Phase 8 - mesure locale des salves.
#
# Par defaut on utilise docker-compose.prod.yml, car ce fichier est pret pour
# `--scale api=N` : le service api n'a ni container_name ni port hote fixe.
# La mesure part du conteneur front vers http://api:4000/travail, donc elle
# passe par le DNS interne Compose et traverse bien les replicas de l'API.

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
SERVICE="${SERVICE:-api}"
URL="${URL:-http://api:4000/travail}"
REQUESTS="${REQUESTS:-300}"
CONCURRENCY="${CONCURRENCY:-20}"
WARMUP_SECONDS="${WARMUP_SECONDS:-20}"
SCALES="${SCALES:-1 3}"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

NODE_CODE='
const [url, totalArg, concurrencyArg] = process.argv.slice(1);
const total = Number(totalArg || 300);
const concurrency = Number(concurrencyArg || 20);
let next = 0;
let ok = 0;
let failed = 0;
async function worker() {
  while (true) {
    const current = next++;
    if (current >= total) return;
    try {
      const response = await fetch(url);
      if (response.ok) ok++;
      else failed++;
    } catch {
      failed++;
    }
  }
}
const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const seconds = (performance.now() - started) / 1000;
console.log(JSON.stringify({
  url,
  total,
  concurrency,
  ok,
  failed,
  seconds: Number(seconds.toFixed(3)),
  ok_per_second: Number((ok / seconds).toFixed(2))
}, null, 2));
'

echo "| scale | total | ok | failed | seconds | ok/s |"
echo "|---:|---:|---:|---:|---:|---:|"

for scale in $SCALES; do
  compose up -d --scale "$SERVICE=$scale" >/dev/null 2>&1
  sleep "$WARMUP_SECONDS"

  result="$(compose exec -T front node -e "$NODE_CODE" "$URL" "$REQUESTS" "$CONCURRENCY")"

  node -e '
    const fs = require("node:fs");
    const scale = process.argv[1];
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    console.log(`| ${scale} | ${data.total} | ${data.ok} | ${data.failed} | ${data.seconds} | ${data.ok_per_second} |`);
  ' "$scale" <<< "$result"
done

echo
echo "A reporter dans docs/CARNET_FLOTTE.md avec le contexte machine et commit."
