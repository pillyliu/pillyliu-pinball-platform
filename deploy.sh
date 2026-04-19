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
PINPROF_ADMIN_SOURCE_ROOT="${PINPROF_ADMIN_SOURCE_ROOT:-$ROOT_DIR/../PinProf Admin}"
PINPROF_ADMIN_WORKSPACE_ROOT="${PINPROF_ADMIN_WORKSPACE_ROOT:-$PINPROF_ADMIN_SOURCE_ROOT/workspace}"
PINPROF_ADMIN_SOURCE_DATA_DIR="${PINPROF_ADMIN_SOURCE_DATA_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/data/source}"
PINPROF_ADMIN_PUBLISHED_DATA_DIR="${PINPROF_ADMIN_PUBLISHED_DATA_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/data/published}"
PINPROF_ADMIN_DB_DIR="${PINPROF_ADMIN_DB_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/db}"
PINPROF_ADMIN_PLAYFIELDS_DIR="${PINPROF_ADMIN_PLAYFIELDS_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/assets/playfields}"
PINPROF_ADMIN_BACKGLASSES_DIR="${PINPROF_ADMIN_BACKGLASSES_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/assets/backglasses}"
PINPROF_ADMIN_RULESHEETS_DIR="${PINPROF_ADMIN_RULESHEETS_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/assets/rulesheets}"
PINPROF_ADMIN_GAMEINFO_DIR="${PINPROF_ADMIN_GAMEINFO_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/assets/gameinfo}"
PINPROF_ADMIN_MANIFESTS_DIR="${PINPROF_ADMIN_MANIFESTS_DIR:-$PINPROF_ADMIN_WORKSPACE_ROOT/manifests}"
PINPROF_ADMIN_APP_PRELOAD_ROOT="${PINPROF_ADMIN_APP_PRELOAD_ROOT:-$PINPROF_ADMIN_WORKSPACE_ROOT/app-preload}"
PINBALL_API_SOURCE_DIR="${PINBALL_API_SOURCE_DIR:-$ROOT_DIR/shared/pinball-api}"
PINPROF_ADMIN_FRONTEND_DIR="${PINPROF_ADMIN_FRONTEND_DIR:-$PINPROF_ADMIN_SOURCE_ROOT/apps/admin-ui}"
PINPROF_ADMIN_FRONTEND_DIST="${PINPROF_ADMIN_FRONTEND_DIST:-$PINPROF_ADMIN_FRONTEND_DIR/dist}"
PINPROF_ADMIN_SITE_RUNTIME="${PINPROF_ADMIN_SITE_RUNTIME:-$PINPROF_ADMIN_SOURCE_ROOT/apps/admin-site-runtime}"
PINPROF_APP_SOURCE_ROOT="${PINPROF_APP_SOURCE_ROOT:-$ROOT_DIR/../Pinball App}"
PINPROF_APP_SHARED_ASSET_SYNC_SCRIPT="${PINPROF_APP_SHARED_ASSET_SYNC_SCRIPT:-$PINPROF_APP_SOURCE_ROOT/scripts/sync_shared_app_assets.sh}"
IOS_APP_ROOT="${IOS_APP_ROOT:-$PINPROF_APP_SOURCE_ROOT/Pinball App 2/Pinball App 2}"
IOS_PINBALL_PRELOAD_BUNDLE_DIR="${IOS_PINBALL_PRELOAD_BUNDLE_DIR:-$IOS_APP_ROOT/PinballPreload.bundle}"
ANDROID_APP_ROOT="${ANDROID_APP_ROOT:-$PINPROF_APP_SOURCE_ROOT/Pinball App Android/app/src/main}"
ANDROID_PINBALL_PRELOAD_ASSETS_DIR="${ANDROID_PINBALL_PRELOAD_ASSETS_DIR:-$ANDROID_APP_ROOT/assets/pinprof-preload}"
PINPROF_SITE_SOURCE_DIR="${PINPROF_SITE_SOURCE_DIR:-$DEFAULT_PINPROF_SITE_SOURCE_DIR}"
PINPROF_SITE_REMOTE_ROOT="${PINPROF_SITE_REMOTE_ROOT:-$DEFAULT_PINPROF_SITE_REMOTE_ROOT}"
PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT="${PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT:-$PINPROF_ADMIN_SOURCE_ROOT/scripts/publish/rebuild-shared-pinball-payload.sh}"
PINBALL_REMOTE_PROTECTED_PATHS="${PINBALL_REMOTE_PROTECTED_PATHS:-}"

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

stage_merge_tree() {
  local source_dir="$1"
  local target_dir="$2"
  shift 2
  if [[ ! -d "${source_dir}" ]]; then
    echo "Missing deploy source directory: ${source_dir}" >&2
    exit 1
  fi
  mkdir -p "${target_dir}"
  rsync -a "$@" "${source_dir}/" "${target_dir}/"
}

stage_playfield_publish_set() {
  local source_dir="$1"
  local target_dir="$2"
  if [[ ! -d "${source_dir}" ]]; then
    echo "Missing playfield source directory: ${source_dir}" >&2
    exit 1
  fi

  mkdir -p "${target_dir}"
  while IFS= read -r -d '' source_path; do
    local filename
    filename="$(basename "${source_path}")"
    case "${filename}" in
      .DS_Store|.gitkeep)
        continue
        ;;
    esac

    local ext="${filename##*.}"
    local lower_ext
    lower_ext="$(printf '%s' "${ext}" | tr '[:upper:]' '[:lower:]')"
    if [[ "${lower_ext}" != "webp" ]]; then
      local stem="${filename%.*}"
      if [[ -f "${source_dir}/${stem}.webp" ]]; then
        continue
      fi
    fi

    stage_copy_file "${source_path}" "${target_dir}/${filename}"
  done < <(find "${source_dir}" -maxdepth 1 -type f -print0)
}

prune_local_pinball_artifacts() {
  local target_dir="$1"
  rm -f \
    "${target_dir}/.DS_Store" \
    "${target_dir}/data/codex_missing_group_fetch_targets.json" \
    "${target_dir}/data/local_asset_intake_report.json" \
    "${target_dir}/data/opdb_catalog_v1.json" \
    "${target_dir}/data/opdb_curated_video_resources_v1.json" \
    "${target_dir}/data/pinball_library.csv" \
    "${target_dir}/data/pinball_library_flat_v1.json" \
    "${target_dir}/data/pinball_library_seed_overrides_v1.json" \
    "${target_dir}/data/pinball_library_v3.json" \
    "${target_dir}/data/pinside_link_audit_report.json" \
    "${target_dir}/data/pinside_resolved_machine_map.final.json" \
    "${target_dir}/data/pinside_resolved_machine_map.json" \
    "${target_dir}/data/pinprof_admin_v1.sqlite" \
    "${target_dir}/data/pinprof_admin_v1.sqlite-shm" \
    "${target_dir}/data/pinprof_admin_v1.sqlite-wal" \
    "${target_dir}/data/venue_metadata_overlays_v1.json" \
    "${target_dir}/data/pinball_library_seed_v1.sqlite" \
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

ensure_repo_workspace_dependencies() {
  local lockfile="${ROOT_DIR}/package-lock.json"
  local node_modules="${ROOT_DIR}/node_modules"

  if [[ ! -d "${node_modules}" || ( -f "${lockfile}" && "${lockfile}" -nt "${node_modules}" ) ]]; then
    echo "Installing npm workspace dependencies for website repo..."
    npm ci
  fi
}

prepare_build_environment() {
  ensure_repo_workspace_dependencies
  ensure_npm_dependencies "${PINPROF_ADMIN_FRONTEND_DIR}" "pinprof-admin"
}

refresh_pinprof_admin_shared_payload() {
  if [[ ! -d "${PINPROF_ADMIN_SOURCE_ROOT}" ]]; then
    echo "Warning: PinProf Admin source root not found, skipping canonical pinball rebuild: ${PINPROF_ADMIN_SOURCE_ROOT}" >&2
    return
  fi

  if [[ -f "${PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT}" ]]; then
    echo "Rebuilding canonical pinball payload from PinProf Admin..."
    bash "${PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT}"
  else
    echo "Warning: Missing PinProf Admin rebuild script: ${PINPROF_ADMIN_REBUILD_SHARED_PAYLOAD_SCRIPT}" >&2
  fi
}

stage_pinball_payload() {
  PINBALL_STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pinball-deploy.XXXXXX")"
  mkdir -p "${PINBALL_STAGE_DIR}/pinball"
  mkdir -p \
    "${PINBALL_STAGE_DIR}/pinball/data" \
    "${PINBALL_STAGE_DIR}/pinball/api" \
    "${PINBALL_STAGE_DIR}/pinball/images/playfields" \
    "${PINBALL_STAGE_DIR}/pinball/images/backglasses" \
    "${PINBALL_STAGE_DIR}/pinball/rulesheets" \
    "${PINBALL_STAGE_DIR}/pinball/gameinfo"

  stage_merge_tree \
    "${PINPROF_ADMIN_SOURCE_DATA_DIR}" \
    "${PINBALL_STAGE_DIR}/pinball/data" \
    --exclude='.gitkeep' \
    --exclude='.DS_Store'
  stage_merge_tree \
    "${PINPROF_ADMIN_PUBLISHED_DATA_DIR}" \
    "${PINBALL_STAGE_DIR}/pinball/data" \
    --exclude='.gitkeep' \
    --exclude='.DS_Store'
  stage_playfield_publish_set \
    "${PINPROF_ADMIN_PLAYFIELDS_DIR}" \
    "${PINBALL_STAGE_DIR}/pinball/images/playfields"
  stage_merge_tree \
    "${PINPROF_ADMIN_BACKGLASSES_DIR}" \
    "${PINBALL_STAGE_DIR}/pinball/images/backglasses" \
    --exclude='.gitkeep' \
    --exclude='.DS_Store'
  stage_merge_tree \
    "${PINPROF_ADMIN_RULESHEETS_DIR}" \
    "${PINBALL_STAGE_DIR}/pinball/rulesheets" \
    --exclude='.gitkeep' \
    --exclude='.DS_Store'
  stage_merge_tree \
    "${PINPROF_ADMIN_GAMEINFO_DIR}" \
    "${PINBALL_STAGE_DIR}/pinball/gameinfo" \
    --exclude='.gitkeep' \
    --exclude='.DS_Store'
  stage_merge_tree \
    "${PINBALL_API_SOURCE_DIR}" \
    "${PINBALL_STAGE_DIR}/pinball/api" \
    --exclude='.gitkeep' \
    --exclude='.DS_Store'

  if [[ -f "${PINPROF_ADMIN_MANIFESTS_DIR}/cache-manifest.json" ]]; then
    stage_copy_file \
      "${PINPROF_ADMIN_MANIFESTS_DIR}/cache-manifest.json" \
      "${PINBALL_STAGE_DIR}/pinball/cache-manifest.json"
  elif [[ -f "${PINPROF_ADMIN_PUBLISHED_DATA_DIR}/cache-manifest.json" ]]; then
    stage_copy_file \
      "${PINPROF_ADMIN_PUBLISHED_DATA_DIR}/cache-manifest.json" \
      "${PINBALL_STAGE_DIR}/pinball/cache-manifest.json"
  fi

  if [[ -f "${PINPROF_ADMIN_MANIFESTS_DIR}/cache-update-log.json" ]]; then
    stage_copy_file \
      "${PINPROF_ADMIN_MANIFESTS_DIR}/cache-update-log.json" \
      "${PINBALL_STAGE_DIR}/pinball/cache-update-log.json"
  elif [[ -f "${PINPROF_ADMIN_PUBLISHED_DATA_DIR}/cache-update-log.json" ]]; then
    stage_copy_file \
      "${PINPROF_ADMIN_PUBLISHED_DATA_DIR}/cache-update-log.json" \
      "${PINBALL_STAGE_DIR}/pinball/cache-update-log.json"
  fi

  find "${PINBALL_STAGE_DIR}/pinball" -name '.DS_Store' -delete
  prune_local_pinball_artifacts "${PINBALL_STAGE_DIR}/pinball"

  local required_files=(
    "cache-manifest.json"
    "cache-update-log.json"
    "api/rulesheet.php"
    "data/opdb_export.json"
    "data/practice_identity_curations_v1.json"
    "data/backglass_assets.json"
    "data/default_pm_venue_sources_v1.json"
    "data/rulesheet_assets.json"
    "data/video_assets.json"
    "data/playfield_assets.json"
    "data/gameinfo_assets.json"
    "data/venue_layout_assets.json"
    "data/LPL_Targets.csv"
    "data/LPL_IFPA_Players.csv"
    "data/lpl_machine_mappings_v1.json"
    "data/lpl_targets_resolved_v1.json"
    "data/LPL_Stats.csv"
    "data/LPL_Standings.csv"
    "data/redacted_players.csv"
    "images/playfields/fallback-image-not-available_2048.webp"
  )

  for rel_path in "${required_files[@]}"; do
    if [[ ! -f "${PINBALL_STAGE_DIR}/pinball/${rel_path}" ]]; then
      echo "Missing deploy artifact: /pinball/${rel_path}" >&2
      exit 1
    fi
  done

  PINBALL_MANIFEST_SOURCE_DIR="${PINBALL_STAGE_DIR}/pinball" node tools/build-pinball-manifest.mjs
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

sync_shared_app_assets_to_local_apps() {
  if [[ ! -d "${PINPROF_APP_SOURCE_ROOT}" ]]; then
    echo "Warning: Pinball App workspace not found, skipping shared app asset sync: ${PINPROF_APP_SOURCE_ROOT}" >&2
    return
  fi

  if [[ ! -f "${PINPROF_APP_SHARED_ASSET_SYNC_SCRIPT}" ]]; then
    return
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Would sync shared app-owned assets into local iOS/Android app resources."
    return
  fi

  echo "Syncing shared app-owned assets into local app workspaces..."
  bash "${PINPROF_APP_SHARED_ASSET_SYNC_SCRIPT}"
}

sync_mobile_app_preload_to_local_apps() {
  local preload_root="${PINPROF_ADMIN_APP_PRELOAD_ROOT}"
  local preload_pinball_dir="${preload_root}/pinball"
  local preload_manifest_path="${preload_root}/preload-manifest.json"

  if [[ ! -d "${PINPROF_APP_SOURCE_ROOT}" ]]; then
    echo "Warning: Pinball App workspace not found, skipping local app preload sync: ${PINPROF_APP_SOURCE_ROOT}" >&2
    return
  fi

  if [[ ! -d "${preload_pinball_dir}" || ! -f "${preload_manifest_path}" ]]; then
    echo "Missing PinProf Admin mobile app preload output under ${preload_root}" >&2
    exit 1
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Would sync mobile app preload bundle into local iOS/Android app resources."
    return
  fi

  echo "Syncing curated mobile app preload into local app workspaces..."

  mkdir -p "${IOS_PINBALL_PRELOAD_BUNDLE_DIR}/pinball"
  rsync -a --delete "${preload_pinball_dir}/" "${IOS_PINBALL_PRELOAD_BUNDLE_DIR}/pinball/"
  rsync -a "${preload_manifest_path}" "${IOS_PINBALL_PRELOAD_BUNDLE_DIR}/preload-manifest.json"

  mkdir -p "${ANDROID_PINBALL_PRELOAD_ASSETS_DIR}/pinball"
  rsync -a --delete "${preload_pinball_dir}/" "${ANDROID_PINBALL_PRELOAD_ASSETS_DIR}/pinball/"
  rsync -a "${preload_manifest_path}" "${ANDROID_PINBALL_PRELOAD_ASSETS_DIR}/preload-manifest.json"
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
# Protected paths stay on the remote host even after we stop staging them locally.
PINBALL_RSYNC_OPTS=("${RSYNC_OPTS[@]}" --checksum)
if [[ -n "${PINBALL_REMOTE_PROTECTED_PATHS}" ]]; then
  PINBALL_REMOTE_PROTECTED_PATH_ARRAY=()
  IFS=',' read -r -a PINBALL_REMOTE_PROTECTED_PATH_ARRAY <<< "${PINBALL_REMOTE_PROTECTED_PATHS}"
  for rel_path in "${PINBALL_REMOTE_PROTECTED_PATH_ARRAY[@]}"; do
    rel_path="${rel_path#"${rel_path%%[![:space:]]*}"}"
    rel_path="${rel_path%"${rel_path##*[![:space:]]}"}"
    if [[ -z "${rel_path}" ]]; then
      continue
    fi
    rel_path="${rel_path#/}"
    PINBALL_RSYNC_OPTS+=(--filter="P /${rel_path}")
  done
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
if [[ -n "${PINPROF_SITE_SOURCE_DIR}" && -n "${PINPROF_SITE_REMOTE_ROOT}" ]]; then
  echo "PinProf.com target: ${SSH_USER_HOST}:${PINPROF_SITE_REMOTE_ROOT}"
elif [[ -n "${PINPROF_SITE_SOURCE_DIR}" || -n "${PINPROF_SITE_REMOTE_ROOT}" ]]; then
  echo "PinProf.com deploy disabled: set both PINPROF_SITE_SOURCE_DIR and PINPROF_SITE_REMOTE_ROOT."
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  refresh_pinprof_admin_shared_payload
else
  echo "Skipping canonical pinball payload refresh because --skip-build was requested."
fi

sync_shared_app_assets_to_local_apps
sync_mobile_app_preload_to_local_apps

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  prepare_build_environment

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
