#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SSH_USER_HOST="${SSH_USER_HOST:-pillyliu@67.222.24.219}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pillyliu_key}"
REMOTE_ROOT="${REMOTE_ROOT:-/home/pillyliu/public_html}"
SSH_AUTH_MODE="${SSH_AUTH_MODE:-key}" # key | password
PINBALL_LIBRARY_CSV_URL="${PINBALL_LIBRARY_CSV_URL:-https://docs.google.com/spreadsheets/d/e/2PACX-1vTlFuhuOFWj3Wbki2wOaHTUCUojPQ_5DsPJ8ta4P0zlQNLijHFHwbSQ7gJhosdlWVn-todC_t9AWmkq/pub?gid=2051576512&single=true&output=csv}"
PINBALL_LIBRARY_CSV_LOCAL="${PINBALL_LIBRARY_CSV_LOCAL:-shared/pinball/data/Avenue Pinball - Current.csv}"
PINBALL_SYNC_INCLUDE_WEB_PUBLIC_PINBALL="${PINBALL_SYNC_INCLUDE_WEB_PUBLIC_PINBALL:-0}"

DRY_RUN=0
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./deploy.sh [--dry-run] [--skip-build]"
      exit 1
      ;;
  esac
done

if [[ "${SSH_AUTH_MODE}" == "password" ]]; then
  RSYNC_SSH="ssh -p ${SSH_PORT} -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive"
else
  RSYNC_SSH="ssh -p ${SSH_PORT} -i ${SSH_KEY}"
fi
RSYNC_OPTS=(-avz --delete -e "$RSYNC_SSH")
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_OPTS+=(--dry-run)
fi

REMOTE="${SSH_USER_HOST}:${REMOTE_ROOT}"

echo "Deploy target: ${SSH_USER_HOST}:${REMOTE_ROOT}"
echo "SSH auth mode: ${SSH_AUTH_MODE}"
if [[ "${SSH_AUTH_MODE}" != "password" ]]; then
  echo "SSH key: ${SSH_KEY}"
fi
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Mode: DRY RUN"
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  if [[ -n "${PINBALL_LIBRARY_CSV_URL}" ]]; then
    echo "Downloading published pinball CSV..."
    curl -fsSL "$PINBALL_LIBRARY_CSV_URL" -o "$PINBALL_LIBRARY_CSV_LOCAL"
  fi

  echo "Regenerating pinball data (v1 + v2 JSON, manifest) and syncing mobile starter packs..."
  if [[ "$PINBALL_SYNC_INCLUDE_WEB_PUBLIC_PINBALL" == "1" ]]; then
    node tools/sync-pinball-data.mjs --all-targets --include-web-public-pinball
  else
    npm run sync:pinball:all-targets
  fi

  echo "Running app builds + smoke..."
  npm run build:all
  npm run check:smoke
fi

echo "Deploying landing..."
rsync "${RSYNC_OPTS[@]}" pillyliu-landing/dist/assets/ "${REMOTE}/assets/"
rsync "${RSYNC_OPTS[@]}" pillyliu-landing/dist/privacy/ "${REMOTE}/privacy/"
for file in \
  index.html \
  favicon.ico \
  favicon-16x16.png \
  favicon-32x32.png \
  apple-touch-icon.png \
  android-chrome-192x192.png \
  android-chrome-512x512.png \
  site.webmanifest \
  peter-pinball.jpg
do
  if [[ -f "pillyliu-landing/dist/${file}" ]]; then
    rsync -avz -e "$RSYNC_SSH" "pillyliu-landing/dist/${file}" "${REMOTE}/${file}"
  fi
done

echo "Deploying canonical pinball data..."
rsync "${RSYNC_OPTS[@]}" shared/pinball/ "${REMOTE}/pinball/"
if [[ "$DRY_RUN" -eq 0 ]]; then
  echo "Normalizing remote pinball permissions..."
  if [[ "${SSH_AUTH_MODE}" == "password" ]]; then
    ssh -p "${SSH_PORT}" "${SSH_USER_HOST}" \
      "find '${REMOTE_ROOT}/pinball' -type d -exec chmod 755 {} \\; && find '${REMOTE_ROOT}/pinball' -type f -exec chmod 644 {} \\;"
  else
    ssh -p "${SSH_PORT}" -i "${SSH_KEY}" "${SSH_USER_HOST}" \
      "find '${REMOTE_ROOT}/pinball' -type d -exec chmod 755 {} \\; && find '${REMOTE_ROOT}/pinball' -type f -exec chmod 644 {} \\;"
  fi
fi

echo "Deploying apps..."
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-library/dist/ "${REMOTE}/lpl-library/"
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-stats/dist/ "${REMOTE}/lpl-stats/"
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-standings/dist/ "${REMOTE}/lpl-standings/"
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-targets/dist/ "${REMOTE}/lpl-targets/"

echo "Deploy complete."
