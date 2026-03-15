#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

DEFAULT_PINPROF_SITE_SOURCE_DIR=""
DEFAULT_PINPROF_SITE_REMOTE_ROOT=""
if [[ -d "${ROOT_DIR}/../PinProf.com" ]]; then
  DEFAULT_PINPROF_SITE_SOURCE_DIR="${ROOT_DIR}/../PinProf.com"
  DEFAULT_PINPROF_SITE_REMOTE_ROOT="/home/pillyliu/pinprof.com"
fi

SSH_USER_HOST="${SSH_USER_HOST:-pillyliu@67.222.24.219}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pillyliu_key}"
REMOTE_ROOT="${REMOTE_ROOT:-/home/pillyliu/public_html}"
SSH_AUTH_MODE="${SSH_AUTH_MODE:-key}" # key | password
PINPROF_PRODUCT_ROOT="${PINPROF_PRODUCT_ROOT:-$ROOT_DIR/../Pinball App}"
PINPROF_ADMIN_SOURCE_ROOT="${PINPROF_ADMIN_SOURCE_ROOT:-$ROOT_DIR/../PinProf Admin}"
SHARED_PINBALL_SOURCE_DIR="${SHARED_PINBALL_SOURCE_DIR:-$ROOT_DIR/shared/pinball}"
PINPROF_ADMIN_FRONTEND_DIR="${PINPROF_ADMIN_FRONTEND_DIR:-$ROOT_DIR/pinprof-admin}"
PINPROF_ADMIN_FRONTEND_DIST="${PINPROF_ADMIN_FRONTEND_DIST:-$PINPROF_ADMIN_FRONTEND_DIR/dist}"
PINPROF_ADMIN_SITE_RUNTIME="${PINPROF_ADMIN_SITE_RUNTIME:-$ROOT_DIR/pinprof-admin-site}"
PINPROF_SITE_SOURCE_DIR="${PINPROF_SITE_SOURCE_DIR:-$DEFAULT_PINPROF_SITE_SOURCE_DIR}"
PINPROF_SITE_REMOTE_ROOT="${PINPROF_SITE_REMOTE_ROOT:-$DEFAULT_PINPROF_SITE_REMOTE_ROOT}"
PINBALL_LIBRARY_CSV_URL="${PINBALL_LIBRARY_CSV_URL:-https://docs.google.com/spreadsheets/d/e/2PACX-1vTlFuhuOFWj3Wbki2wOaHTUCUojPQ_5DsPJ8ta4P0zlQNLijHFHwbSQ7gJhosdlWVn-todC_t9AWmkq/pub?gid=2051576512&single=true&output=csv}"
PINBALL_LIBRARY_CSV_LOCAL="${PINBALL_LIBRARY_CSV_LOCAL:-shared/pinball/data/Avenue Pinball - Current.csv}"
PINBALL_SYNC_INCLUDE_WEB_PUBLIC_PINBALL="${PINBALL_SYNC_INCLUDE_WEB_PUBLIC_PINBALL:-0}"
PINBALL_IOS_STARTER_PACK_SOURCE="${PINBALL_IOS_STARTER_PACK_SOURCE:-$PINPROF_PRODUCT_ROOT/Pinball App 2/Pinball App 2/PinballStarter.bundle/pinball}"
PINBALL_ANDROID_STARTER_PACK_SOURCE="${PINBALL_ANDROID_STARTER_PACK_SOURCE:-$PINPROF_PRODUCT_ROOT/Pinball App Android/app/src/main/assets/starter-pack/pinball}"
PINBALL_ANDROID_BUILD_DEBUG_SOURCE="${PINBALL_ANDROID_BUILD_DEBUG_SOURCE:-$PINPROF_PRODUCT_ROOT/Pinball App Android/app/build/intermediates/assets/debug/mergeDebugAssets/starter-pack/pinball}"
PINBALL_ANDROID_BUILD_RELEASE_SOURCE="${PINBALL_ANDROID_BUILD_RELEASE_SOURCE:-$PINPROF_PRODUCT_ROOT/Pinball App Android/app/build/intermediates/assets/release/mergeReleaseAssets/starter-pack/pinball}"
PINPROF_ADMIN_SYNC_SCRIPT="${PINPROF_ADMIN_SYNC_SCRIPT:-$PINPROF_ADMIN_SOURCE_ROOT/scripts/publish/sync-legacy-website-layout.sh}"
PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT="${PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT:-$PINPROF_ADMIN_SOURCE_ROOT/scripts/publish/rebuild-shared-pinball-payload.sh}"
PINPROF_ADMIN_APPLY_OVERRIDES_SCRIPT="${PINPROF_ADMIN_APPLY_OVERRIDES_SCRIPT:-$PINPROF_ADMIN_SOURCE_ROOT/scripts/publish/apply-admin-overrides.mjs}"
PINPROF_ADMIN_EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT="${PINPROF_ADMIN_EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT:-$PINPROF_ADMIN_SOURCE_ROOT/scripts/publish/export_library_seed_overrides.py}"

PINBALL_STAGE_DIR=""
PINPROF_ADMIN_STAGE_DIR=""
PINPROF_SITE_STAGE_DIR=""

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
  if [[ -n "${PINPROF_SITE_STAGE_DIR}" && -d "${PINPROF_SITE_STAGE_DIR}" ]]; then
    rm -rf "${PINPROF_SITE_STAGE_DIR}"
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
    "${PINPROF_ADMIN_FRONTEND_DIST}"
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
  ensure_npm_dependencies "${PINPROF_ADMIN_FRONTEND_DIR}" "pinprof-admin"
}

refresh_pinprof_admin_shared_payload() {
  if [[ ! -d "${PINPROF_ADMIN_SOURCE_ROOT}" ]]; then
    echo "Warning: PinProf Admin source root not found; skipping workspace refresh: ${PINPROF_ADMIN_SOURCE_ROOT}" >&2
    return
  fi
  if [[ ! -x "${PINPROF_ADMIN_SYNC_SCRIPT}" ]]; then
    echo "Warning: PinProf Admin sync bridge not found; skipping workspace refresh: ${PINPROF_ADMIN_SYNC_SCRIPT}" >&2
    return
  fi

  echo "Refreshing shared pinball payload from PinProf Admin workspace..."
  if [[ -f "${PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT}" ]]; then
    bash "${PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT}"
  else
    if [[ -f "${PINPROF_ADMIN_APPLY_OVERRIDES_SCRIPT}" ]]; then
      node "${PINPROF_ADMIN_APPLY_OVERRIDES_SCRIPT}"
    fi
    if [[ -f "${PINPROF_ADMIN_EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT}" ]]; then
      python3 "${PINPROF_ADMIN_EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT}"
    fi
  fi
  "${PINPROF_ADMIN_SYNC_SCRIPT}" --skip-admin-ui --skip-admin-site
}

stage_pinball_payload() {
  local shared_pinball_dir="${SHARED_PINBALL_SOURCE_DIR}"
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
    "images/playfields/fallback-image-not-available_2048.webp"
    "images/ui/shake-warnings/professor-danger_1024.webp"
    "images/ui/shake-warnings/professor-danger-danger_1024.webp"
    "images/ui/shake-warnings/professor-tilt_1024.webp"
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
  local frontend_dist="${PINPROF_ADMIN_FRONTEND_DIST}"
  local site_runtime="${PINPROF_ADMIN_SITE_RUNTIME}"
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

stage_pinprof_site_payload() {
  local site_source_dir="${PINPROF_SITE_SOURCE_DIR}"
  if [[ ! -d "${site_source_dir}" ]]; then
    echo "Missing PinProf.com site source: ${site_source_dir}" >&2
    exit 1
  fi

  PINPROF_SITE_STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pinprof-site-deploy.XXXXXX")"
  rsync -a \
    --exclude='.git' \
    --exclude='.gitignore' \
    --exclude='node_modules' \
    --exclude='.DS_Store' \
    --exclude='README.md' \
    --exclude='package.json' \
    "${site_source_dir}/" "${PINPROF_SITE_STAGE_DIR}/"
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
if [[ -n "${PINPROF_SITE_SOURCE_DIR}" && -n "${PINPROF_SITE_REMOTE_ROOT}" ]]; then
  echo "PinProf.com target: ${SSH_USER_HOST}:${PINPROF_SITE_REMOTE_ROOT}"
elif [[ -n "${PINPROF_SITE_SOURCE_DIR}" || -n "${PINPROF_SITE_REMOTE_ROOT}" ]]; then
  echo "PinProf.com deploy disabled: set both PINPROF_SITE_SOURCE_DIR and PINPROF_SITE_REMOTE_ROOT."
fi

refresh_pinprof_admin_shared_payload

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  prepare_build_environment

  if [[ -n "${PINBALL_LIBRARY_CSV_URL}" ]]; then
    echo "Downloading published pinball CSV..."
    curl -fsSL "$PINBALL_LIBRARY_CSV_URL" -o "$PINBALL_LIBRARY_CSV_LOCAL"
  fi

  echo "Regenerating pinball data (v3 JSON, seed DB, manifest) and syncing mobile starter packs..."
  if [[ "$PINBALL_SYNC_INCLUDE_WEB_PUBLIC_PINBALL" == "1" ]]; then
    node tools/sync-pinball-data.mjs --all-targets --use-existing-shared-support-artifacts --include-web-public-pinball
  else
    node tools/sync-pinball-data.mjs --all-targets --use-existing-shared-support-artifacts
  fi

  echo "Running app builds + smoke..."
  npm run build:all
  npm --prefix "${PINPROF_ADMIN_FRONTEND_DIR}" run build
  npm run check:smoke
fi

stage_pinball_payload
stage_pinprof_admin_payload
if [[ -n "${PINPROF_SITE_SOURCE_DIR}" && -n "${PINPROF_SITE_REMOTE_ROOT}" ]]; then
  stage_pinprof_site_payload
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
if [[ -n "${PINPROF_SITE_STAGE_DIR}" && -n "${PINPROF_SITE_REMOTE_ROOT}" ]]; then
  echo "Deploying PinProf.com..."
  rsync "${RSYNC_OPTS[@]}" --filter='P .well-known/' "${PINPROF_SITE_STAGE_DIR}/" "${SSH_USER_HOST}:${PINPROF_SITE_REMOTE_ROOT}/"
fi

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

if [[ "$DRY_RUN" -eq 0 && -n "${PINPROF_SITE_STAGE_DIR}" && -n "${PINPROF_SITE_REMOTE_ROOT}" ]]; then
  echo "Normalizing remote PinProf.com permissions..."
  if [[ "${SSH_AUTH_MODE}" == "password" ]]; then
    ssh -p "${SSH_PORT}" "${SSH_USER_HOST}" \
      "find '${PINPROF_SITE_REMOTE_ROOT}' -type d -exec chmod 755 {} \\; && find '${PINPROF_SITE_REMOTE_ROOT}' -type f -exec chmod 644 {} \\;"
  else
    ssh -p "${SSH_PORT}" -i "${SSH_KEY}" "${SSH_USER_HOST}" \
      "find '${PINPROF_SITE_REMOTE_ROOT}' -type d -exec chmod 755 {} \\; && find '${PINPROF_SITE_REMOTE_ROOT}' -type f -exec chmod 644 {} \\;"
  fi
fi

if [[ "$DRY_RUN" -eq 0 && "$SKIP_BUILD" -eq 0 ]]; then
  echo "Removing local dist outputs..."
  cleanup_local_dist_outputs
fi

echo "Deploy complete."
