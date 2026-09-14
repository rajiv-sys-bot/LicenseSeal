#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${PROJECT_ROOT}/contracts/managed/doctor_license"
TARGET_DIR="${PROJECT_ROOT}/public/zk/doctor_license"

if [[ ! -d "${SOURCE_DIR}/keys" || ! -d "${SOURCE_DIR}/zkir" ]]; then
  echo "Compiled contract assets missing. Run npm run contract:compile first." >&2
  exit 1
fi

# Remove artifacts from circuits deleted since the previous compile. Leaving
# stale files makes the served bundle disagree with contract-info.json.
rm -rf "${TARGET_DIR}/keys" "${TARGET_DIR}/zkir"
mkdir -p "${TARGET_DIR}/keys" "${TARGET_DIR}/zkir"
cp -R "${SOURCE_DIR}/keys/." "${TARGET_DIR}/keys/"
cp -R "${SOURCE_DIR}/zkir/." "${TARGET_DIR}/zkir/"
echo "Doctor license proving assets synced: ${TARGET_DIR}"
