#!/usr/bin/env bash
set -euo pipefail

# Kill processes listening on common Expo/Metro ports.
# Usage:
#   ./scripts/kill-dev.sh                 # kills defaults: 8081 19000 19001 19002
#   ./scripts/kill-dev.sh 8081 3000 5173  # kills the specified ports

PORTS=("8081" "19000" "19001" "19002")

if [ "$#" -gt 0 ]; then
  PORTS=("$@")
fi

for PORT in "${PORTS[@]}"; do
  # Find PIDs bound to the TCP port (macOS-compatible)
  PIDS=$(lsof -ti tcp:$PORT || true)
  if [ -n "$PIDS" ]; then
    echo "Killing processes on port $PORT: $PIDS"
    # Use SIGKILL to ensure stubborn Metro/Expo processes terminate
    kill -9 $PIDS 2>/dev/null || true
  else
    echo "No process found on port $PORT"
  fi
done

echo "Done."


