#!/usr/bin/env bash
set -euo pipefail

# Compatibility launcher retained for existing website workflows. Admin owns
# release assembly and dual-origin publication.
WEBSITE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PINPROF_ADMIN_SOURCE_ROOT="${PINPROF_ADMIN_SOURCE_ROOT:-${WEBSITE_ROOT}/../PinProf Admin}"
CANONICAL_PUBLISHER="${PINPROF_ADMIN_SOURCE_ROOT}/scripts/publish/publish-field-guide-release.sh"
if [[ ! -x "${CANONICAL_PUBLISHER}" ]]; then
  echo "Missing canonical PinProf Admin Field Guide publisher: ${CANONICAL_PUBLISHER}" >&2
  exit 1
fi
exec "${CANONICAL_PUBLISHER}" "$@"
