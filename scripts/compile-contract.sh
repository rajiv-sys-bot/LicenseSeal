#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_FILE="${PROJECT_ROOT}/contracts/doctor_license.compact"
OUTPUT_DIR="${PROJECT_ROOT}/contracts/managed/doctor_license"
COMPACT_VERSION="${COMPACT_VERSION:-0.31.1}"

if [[ ! -f "${SOURCE_FILE}" ]]; then
  echo "Contract source missing: ${SOURCE_FILE}" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

if [[ -n "${COMPACTC_BIN:-}" ]]; then
  "${COMPACTC_BIN}" "${SOURCE_FILE}" "${OUTPUT_DIR}"
elif command -v compact >/dev/null 2>&1; then
  compact compile "+${COMPACT_VERSION}" "${SOURCE_FILE}" "${OUTPUT_DIR}"
elif command -v compactc >/dev/null 2>&1; then
  compactc "${SOURCE_FILE}" "${OUTPUT_DIR}"
else
  echo "Compact compiler missing. Install Compact CLI or set COMPACTC_BIN." >&2
  exit 127
fi

test -f "${OUTPUT_DIR}/contract/index.js"
test -f "${OUTPUT_DIR}/contract/index.d.ts"
echo "Doctor license contract compiled: ${OUTPUT_DIR}"
