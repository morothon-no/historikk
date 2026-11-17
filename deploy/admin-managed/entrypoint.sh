#!/bin/sh
set -eu
# Fly attaches the approved volume before this runs. Do not create an ephemeral fallback.
if ! mountpoint -q /data; then echo 'A mounted private volume is required.' >&2; exit 1; fi
if [ ! -e /data/morothon ]; then
  mkdir -m 700 /data/morothon
  chown 10001:10001 /data/morothon
fi
# Never silently change ownership/permissions of an existing data directory.
if [ "$(stat -c '%u:%g:%a' /data/morothon)" != '10001:10001:700' ]; then
  echo 'Private volume ownership or permissions need review.' >&2; exit 1
fi
export HOME=/data/morothon
exec setpriv --reuid=10001 --regid=10001 --init-groups --inh-caps=-all --bounding-set=-all --no-new-privs \
  node /app/scripts/admin/managed-deployment.cjs serve
