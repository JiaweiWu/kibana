#!/usr/bin/env bash

set -euo pipefail

source .buildkite/scripts/common/util.sh

.buildkite/scripts/bootstrap.sh
.buildkite/scripts/download_build_artifacts.sh
.buildkite/scripts/copy_es_snapshot_cache.sh

export JOB=kibana-profiling-cypress

echo "--- Profiling Cypress Tests"

cd "$XPACK_DIR"

NODE_OPTIONS=--openssl-legacy-provider node solutions/observability/plugins/profiling/scripts/test/e2e.js \
  --kibana-install-dir "$KIBANA_BUILD_LOCATION" \