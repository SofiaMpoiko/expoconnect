#!/bin/sh
set -e
cd /app/backend
node src/server.js &
nginx -g 'daemon off;'
