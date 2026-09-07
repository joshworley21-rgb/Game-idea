#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-Development}"
if [[ "$CONFIGURATION" != "Development" && "$CONFIGURATION" != "Shipping" ]]; then
  echo "Usage: $0 [Development|Shipping] [output-directory]" >&2
  exit 2
fi

if [[ -z "${UE_ROOT:-}" ]]; then
  echo "Set UE_ROOT to the installed Unreal Engine directory." >&2
  exit 2
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_FILE="$PROJECT_ROOT/PresidentSimulator.uproject"
OUTPUT_DIRECTORY="${2:-$PROJECT_ROOT/Releases/Android}"
RUN_UAT="$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh"

if [[ ! -x "$RUN_UAT" ]]; then
  echo "RunUAT.sh was not found under UE_ROOT: $RUN_UAT" >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIRECTORY"

"$RUN_UAT" BuildCookRun \
  "-project=$PROJECT_FILE" \
  -noP4 \
  -platform=Android \
  "-clientconfig=$CONFIGURATION" \
  -build \
  -cook \
  -stage \
  -pak \
  -package \
  -archive \
  "-archivedirectory=$OUTPUT_DIRECTORY" \
  -utf8output

echo "Android package written to $OUTPUT_DIRECTORY"
