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
PINBALL_IOS_STARTER_PACK_SOURCE="${PINBALL_IOS_STARTER_PACK_SOURCE:-$ROOT_DIR/../Pinball App/Pinball App 2/Pinball App 2/PinballStarter.bundle/pinball}"
PINBALL_ANDROID_STARTER_PACK_SOURCE="${PINBALL_ANDROID_STARTER_PACK_SOURCE:-$ROOT_DIR/../Pinball App/Pinball App Android/app/src/main/assets/starter-pack/pinball}"
PINBALL_ANDROID_BUILD_DEBUG_SOURCE="${PINBALL_ANDROID_BUILD_DEBUG_SOURCE:-$ROOT_DIR/../Pinball App/Pinball App Android/app/build/intermediates/assets/debug/mergeDebugAssets/starter-pack/pinball}"
PINBALL_ANDROID_BUILD_RELEASE_SOURCE="${PINBALL_ANDROID_BUILD_RELEASE_SOURCE:-$ROOT_DIR/../Pinball App/Pinball App Android/app/build/intermediates/assets/release/mergeReleaseAssets/starter-pack/pinball}"

PINBALL_STAGE_DIR=""
PINPROF_ADMIN_STAGE_DIR=""

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

cleanup() {
  if [[ -n "${PINBALL_STAGE_DIR}" && -d "${PINBALL_STAGE_DIR}" ]]; then
    rm -rf "${PINBALL_STAGE_DIR}"
  fi
  if [[ -n "${PINPROF_ADMIN_STAGE_DIR}" && -d "${PINPROF_ADMIN_STAGE_DIR}" ]]; then
    rm -rf "${PINPROF_ADMIN_STAGE_DIR}"
  fi
}
trap cleanup EXIT

cleanup_local_dist_outputs() {
  local dist_dirs=(
    "${ROOT_DIR}/pillyliu-landing/dist"
    "${ROOT_DIR}/lpl-library/dist"
    "${ROOT_DIR}/lpl-standings/dist"
    "${ROOT_DIR}/lpl-stats/dist"
    "${ROOT_DIR}/lpl-targets/dist"
    "${ROOT_DIR}/pinprof-admin/dist"
  )

  for dist_dir in "${dist_dirs[@]}"; do
    if [[ -d "${dist_dir}" ]]; then
      rm -rf "${dist_dir}"
    fi
  done
}

stage_copy_tree() {
  local source_dir="$1"
  local target_dir="$2"
  mkdir -p "${target_dir}"
  rsync -a "${source_dir}/" "${target_dir}/"
}

stage_copy_file() {
  local source_path="$1"
  local target_path="$2"
  mkdir -p "$(dirname "${target_path}")"
  rsync -a "${source_path}" "${target_path}"
}

prune_local_pinball_artifacts() {
  local target_dir="$1"
  rm -f \
    "${target_dir}/.DS_Store" \
    "${target_dir}/cache-manifest.json" \
    "${target_dir}/cache-update-log.json" \
    "${target_dir}/data/local_asset_intake_report.json" \
    "${target_dir}/data/pinprof_admin_v1.sqlite" \
    "${target_dir}/data/pinprof_admin_v1.sqlite-shm" \
    "${target_dir}/data/pinprof_admin_v1.sqlite-wal" \
    "${target_dir}/data/pinball_library_seed_v1.sqlite-shm" \
    "${target_dir}/data/pinball_library_seed_v1.sqlite-wal"
}

ensure_npm_dependencies() {
  local package_dir="$1"
  local label="$2"
  local lockfile="${package_dir}/package-lock.json"
  local node_modules="${package_dir}/node_modules"

  if [[ ! -f "${package_dir}/package.json" ]]; then
    return
  fi

  if [[ ! -d "${node_modules}" || ( -f "${lockfile}" && "${lockfile}" -nt "${node_modules}" ) ]]; then
    echo "Installing npm dependencies for ${label}..."
    npm ci --prefix "${package_dir}"
  fi
}

prepare_build_environment() {
  ensure_npm_dependencies "${ROOT_DIR}" "repo root"
  ensure_npm_dependencies "${ROOT_DIR}/pillyliu-landing" "pillyliu-landing"
  ensure_npm_dependencies "${ROOT_DIR}/lpl-library" "lpl-library"
  ensure_npm_dependencies "${ROOT_DIR}/lpl-standings" "lpl-standings"
  ensure_npm_dependencies "${ROOT_DIR}/lpl-stats" "lpl-stats"
  ensure_npm_dependencies "${ROOT_DIR}/lpl-targets" "lpl-targets"
  ensure_npm_dependencies "${ROOT_DIR}/pinprof-admin" "pinprof-admin"
}

stage_pinball_payload() {
  local shared_pinball_dir="${ROOT_DIR}/shared/pinball"
  if [[ ! -d "${shared_pinball_dir}" ]]; then
    echo "Missing shared pinball source: ${shared_pinball_dir}" >&2
    exit 1
  fi

  PINBALL_STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pinball-deploy.XXXXXX")"
  mkdir -p "${PINBALL_STAGE_DIR}/pinball"
  stage_copy_tree "${shared_pinball_dir}" "${PINBALL_STAGE_DIR}/pinball"

  if [[ -d "${PINBALL_IOS_STARTER_PACK_SOURCE}" ]]; then
    stage_copy_tree "${PINBALL_IOS_STARTER_PACK_SOURCE}" "${PINBALL_STAGE_DIR}/pinball"
  else
    echo "Warning: iOS starter-pack source not found: ${PINBALL_IOS_STARTER_PACK_SOURCE}" >&2
  fi

  if [[ -d "${PINBALL_ANDROID_STARTER_PACK_SOURCE}" ]]; then
    stage_copy_tree "${PINBALL_ANDROID_STARTER_PACK_SOURCE}" "${PINBALL_STAGE_DIR}/pinball"
  fi

  find "${PINBALL_STAGE_DIR}/pinball" -name '.DS_Store' -delete
  prune_local_pinball_artifacts "${PINBALL_STAGE_DIR}/pinball"

  local required_files=(
    "cache-manifest.json"
    "cache-update-log.json"
    "data/pinball_library_v3.json"
    "data/opdb_catalog_v1.json"
    "data/pinball_library_seed_v1.sqlite"
    "data/rulesheet_link_audit.json"
    "data/LPL_Targets.csv"
    "data/LPL_Stats.csv"
    "data/LPL_Standings.csv"
    "data/redacted_players.csv"
  )
  local fallback_sources=(
    "${PINBALL_IOS_STARTER_PACK_SOURCE}"
    "${PINBALL_ANDROID_STARTER_PACK_SOURCE}"
    "${PINBALL_ANDROID_BUILD_DEBUG_SOURCE}"
    "${PINBALL_ANDROID_BUILD_RELEASE_SOURCE}"
  )

  for rel_path in "${required_files[@]}"; do
    if [[ -f "${PINBALL_STAGE_DIR}/pinball/${rel_path}" ]]; then
      continue
    fi
    for source_dir in "${fallback_sources[@]}"; do
      if [[ -f "${source_dir}/${rel_path}" ]]; then
        stage_copy_file "${source_dir}/${rel_path}" "${PINBALL_STAGE_DIR}/pinball/${rel_path}"
        break
      fi
    done
  done

  PINBALL_MANIFEST_SOURCE_DIR="${PINBALL_STAGE_DIR}/pinball" node tools/build-pinball-manifest.mjs
  local missing=0
  for rel_path in "${required_files[@]}"; do
    if [[ ! -f "${PINBALL_STAGE_DIR}/pinball/${rel_path}" ]]; then
      echo "Missing deploy artifact: /pinball/${rel_path}" >&2
      missing=1
    fi
  done
  if [[ "${missing}" -ne 0 ]]; then
    exit 1
  fi
}

stage_pinprof_admin_payload() {
  local frontend_dist="${ROOT_DIR}/pinprof-admin/dist"
  local site_runtime="${ROOT_DIR}/pinprof-admin-site"
  if [[ ! -d "${frontend_dist}" ]]; then
    echo "Missing pinprof-admin dist output: ${frontend_dist}" >&2
    exit 1
  fi
  if [[ ! -d "${site_runtime}" ]]; then
    echo "Missing pinprof-admin-site runtime: ${site_runtime}" >&2
    exit 1
  fi

  PINPROF_ADMIN_STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pinprof-admin-deploy.XXXXXX")"
  stage_copy_tree "${frontend_dist}" "${PINPROF_ADMIN_STAGE_DIR}"
  stage_copy_file "${site_runtime}/api.php" "${PINPROF_ADMIN_STAGE_DIR}/api.php"
  stage_copy_file "${site_runtime}/.htaccess" "${PINPROF_ADMIN_STAGE_DIR}/.htaccess"
  mkdir -p "${PINPROF_ADMIN_STAGE_DIR}/lib"
  stage_copy_tree "${site_runtime}/lib" "${PINPROF_ADMIN_STAGE_DIR}/lib"
}

if [[ "${SSH_AUTH_MODE}" == "password" ]]; then
  RSYNC_SSH="ssh -p ${SSH_PORT} -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive"
else
  RSYNC_SSH="ssh -p ${SSH_PORT} -i ${SSH_KEY}"
fi
RSYNC_OPTS=(-avz --delete -e "$RSYNC_SSH")
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_OPTS+=(--dry-run)
fi
# Pinball is staged into a fresh temp dir, so use content checks to avoid reuploading unchanged files.
PINBALL_RSYNC_OPTS=("${RSYNC_OPTS[@]}" --checksum)

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
  prepare_build_environment

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
  npm run build:pinprof-admin
  npm run check:smoke
fi

stage_pinball_payload
stage_pinprof_admin_payload

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
    rsync "${RSYNC_OPTS[@]}" "pillyliu-landing/dist/${file}" "${REMOTE}/${file}"
  fi
done

echo "Deploying canonical pinball data..."
rsync "${PINBALL_RSYNC_OPTS[@]}" "${PINBALL_STAGE_DIR}/pinball/" "${REMOTE}/pinball/"
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
rsync "${RSYNC_OPTS[@]}" --exclude='config.php' "${PINPROF_ADMIN_STAGE_DIR}/" "${REMOTE}/pinprof-admin/"

if [[ "$DRY_RUN" -eq 0 ]]; then
  echo "Normalizing remote pinprof-admin permissions..."
  if [[ "${SSH_AUTH_MODE}" == "password" ]]; then
    ssh -p "${SSH_PORT}" "${SSH_USER_HOST}" \
      "find '${REMOTE_ROOT}/pinprof-admin' -type d -exec chmod 755 {} \\; && find '${REMOTE_ROOT}/pinprof-admin' -type f -exec chmod 644 {} \\;"
  else
    ssh -p "${SSH_PORT}" -i "${SSH_KEY}" "${SSH_USER_HOST}" \
      "find '${REMOTE_ROOT}/pinprof-admin' -type d -exec chmod 755 {} \\; && find '${REMOTE_ROOT}/pinprof-admin' -type f -exec chmod 644 {} \\;"
  fi
fi

if [[ "$DRY_RUN" -eq 0 && "$SKIP_BUILD" -eq 0 ]]; then
  echo "Removing local dist outputs..."
  cleanup_local_dist_outputs
fi

echo "Deploy complete."
