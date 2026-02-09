#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SSH_USER_HOST="${SSH_USER_HOST:-pillyliu@67.222.24.219}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pillyliu_key}"
REMOTE_ROOT="${REMOTE_ROOT:-/home/pillyliu/public_html}"

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

RSYNC_SSH="ssh -p ${SSH_PORT} -i ${SSH_KEY}"
RSYNC_OPTS=(-avz --delete -e "$RSYNC_SSH")
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_OPTS+=(--dry-run)
fi

REMOTE="${SSH_USER_HOST}:${REMOTE_ROOT}"

echo "Deploy target: ${SSH_USER_HOST}:${REMOTE_ROOT}"
echo "SSH key: ${SSH_KEY}"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Mode: DRY RUN"
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Running canonical pinball manifest + build + smoke..."
  npm run sync:pinball
  npm run build:all
  npm run check:smoke
fi

echo "Deploying landing..."
rsync "${RSYNC_OPTS[@]}" pillyliu-landing/dist/assets/ "${REMOTE}/assets/"
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

echo "Deploying apps..."
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-library/dist/ "${REMOTE}/lpl_library/"
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-stats/dist/ "${REMOTE}/lpl_stats/"
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-standings/dist/ "${REMOTE}/lpl_standings/"
rsync "${RSYNC_OPTS[@]}" --exclude='pinball/' lpl-targets/dist/ "${REMOTE}/lpl_targets/"

echo "Deploy complete."
