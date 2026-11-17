# Build context MUST be the generated public-only admin bundle, never the checkout.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium git ca-certificates util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 morothon && useradd --uid 10001 --gid 10001 --home-dir /data/morothon morothon
WORKDIR /app
COPY . .
RUN node scripts/admin/managed-deployment.cjs check \
 && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts --no-audit --no-fund \
 && chmod -R a+rX /app \
 && chmod 755 /app/entrypoint.sh
ENV NODE_ENV=production CHROMIUM_PATH=/usr/bin/chromium PORT=3000 \
 MOROTHON_ADMIN_VOLUME_ROOT=/data MOROTHON_ADMIN_PRIVATE_DIR=/data/morothon \
 MOROTHON_ADMIN_MANAGED_HTTPS=true MOROTHON_PUBLISH_ENABLED=false
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
