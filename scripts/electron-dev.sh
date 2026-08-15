#!/bin/bash
set -euo pipefail

WEB_DEV_SERVER_URL="${NT_WEB_DEV_SERVER_URL:-http://127.0.0.1:3000}"
WEB_SERVER_PID=""

cleanup() {
  if [[ -n "${WEB_SERVER_PID}" ]]; then
    kill "${WEB_SERVER_PID}" >/dev/null 2>&1 || true
    wait "${WEB_SERVER_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

# better-sqlite3 (the only source-built native module) is compiled from source
# against the Node ABI by electron/scripts/rebuild-native.mjs, run from the repo
# root postinstall (after npm finishes reifying the tree). The backend runs on
# vanilla Node, so this same build serves both the Electron main process and the
# system-Node backend (dev-server / tsx). If you hit NODE_MODULE_VERSION errors,
# run: npm run rebuild:native

# Pin the dev backend to the .nvmrc Node rather than whatever the shell happens
# to carry. electron/src/server.ts spawns it as
# `${NODETOOL_NODE:-${npm_node_execpath:-node}}`, so a shell on another major
# hands it a runtime whose ABI better-sqlite3 was not built for, and the run
# dies five seconds later with a NODE_MODULE_VERSION mismatch that reads like a
# broken install. Resolving it here keeps `nvm alias default` a per-machine
# choice instead of a requirement of this repo.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PINNED_NODE_VERSION="$(tr -d '[:space:]' < "${REPO_ROOT}/.nvmrc")"
PINNED_NODE_MAJOR="${PINNED_NODE_VERSION%%.*}"

if [[ -z "${NODETOOL_NODE:-}" ]]; then
  NVM_NODE="${NVM_DIR:-$HOME/.nvm}/versions/node/v${PINNED_NODE_VERSION}/bin/node"
  if [[ -x "${NVM_NODE}" ]]; then
    export NODETOOL_NODE="${NVM_NODE}"
  elif [[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" == "${PINNED_NODE_MAJOR}" ]]; then
    # Not an nvm layout (homebrew, asdf, volta, CI image), but the Node already
    # on PATH is the pinned major — the spawn default is correct as-is.
    :
  else
    echo "ERROR: no Node ${PINNED_NODE_VERSION} available for the dev backend." >&2
    echo "  .nvmrc pins ${PINNED_NODE_VERSION}; this shell has $(node -v 2>/dev/null || echo 'no node')." >&2
    echo "  Fix: nvm install ${PINNED_NODE_VERSION}" >&2
    echo "  Or point NODETOOL_NODE at a Node ${PINNED_NODE_MAJOR} binary yourself." >&2
    exit 1
  fi
fi
echo "Dev backend Node: ${NODETOOL_NODE:-$(command -v node)}"

# Start web Vite server
echo "Starting web Vite server on ${WEB_DEV_SERVER_URL}..."
npm --prefix web run dev &
WEB_SERVER_PID=$!

# Only rebuild electron if source changed since last build
ELECTRON_MARKER="electron/dist-electron/main.js"
if [[ ! -f "${ELECTRON_MARKER}" ]] || \
   [[ -n "$(find electron/src electron/vite.config.ts -newer "${ELECTRON_MARKER}" -print -quit 2>/dev/null)" ]]; then
  echo "Building Electron main/preload bundle (parallel)..."
  npm --prefix electron run vite:build &
  ELECTRON_BUILD_PID=$!
  if ! wait "${ELECTRON_BUILD_PID}"; then
    echo "ERROR: Electron build failed."
    exit 1
  fi
  echo "Electron build done."
else
  echo "Electron build is up to date, skipping."
fi

# Wait for Vite server to be ready
echo "Waiting for Vite server..."
for _ in {1..120}; do
  if curl -sf "${WEB_DEV_SERVER_URL}" >/dev/null; then
    break
  fi
  sleep 0.5
done

if ! curl -sf "${WEB_DEV_SERVER_URL}" >/dev/null; then
  echo "ERROR: Vite server did not become ready at ${WEB_DEV_SERVER_URL}."
  exit 1
fi

echo "Starting Electron in dev mode..."
NT_ELECTRON_DEV_MODE=1 NT_WEB_DEV_SERVER_URL="${WEB_DEV_SERVER_URL}" \
  npm --prefix electron run start:devmode
