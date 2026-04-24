# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# vinex22-travels — web-cloud (Next.js storefront, container variant)
#
# IMPORTANT: build context = repo ROOT, NOT web-cloud/. The canonical product
# catalog lives at data/catalog.json (one level above the app), and src/lib/catalog.ts
# imports it via a relative path. Build with:
#
#   docker build \
#     -f web-cloud/Dockerfile \
#     -t <acr>.azurecr.io/web-cloud:<tag> \
#     .
#
# Runtime authentication: DefaultAzureCredential. In AKS this resolves to the
# federated UAMI via Workload Identity (env: AZURE_CLIENT_ID, AZURE_TENANT_ID,
# AZURE_FEDERATED_TOKEN_FILE — projected by the SA token volume). No SAS, no keys.
# -----------------------------------------------------------------------------

# ---- Stage 1: install deps (cacheable) --------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY web-cloud/package.json web-cloud/package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---- Stage 2: build ----------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_TRACE_ROOT=/build
# NEXT_PUBLIC_* are inlined at build time. Default routes through the in-app
# /api/image proxy that authenticates to Azure Blob Storage with managed identity.
ARG NEXT_PUBLIC_IMAGE_BASE=/api/image
ENV NEXT_PUBLIC_IMAGE_BASE=$NEXT_PUBLIC_IMAGE_BASE
# Copy the canonical catalog at the location src/lib/catalog.ts expects:
# web-cloud/src/lib/catalog.ts uses `import catalogData from '../../../data/catalog.json'`
# Resolved from /build/web-cloud/src/lib → /build/data/catalog.json.
WORKDIR /build
COPY data ./data
COPY web-cloud ./web-cloud
COPY --from=deps /app/node_modules ./web-cloud/node_modules
WORKDIR /build/web-cloud
RUN npm run build

# ---- Stage 3: runtime --------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone server bundles only what server.js needs. Static assets and the
# public/ folder must be copied alongside.
RUN addgroup -S app && adduser -S -G app app
COPY --from=builder --chown=app:app /build/web-cloud/.next/standalone ./
COPY --from=builder --chown=app:app /build/web-cloud/.next/static ./web-cloud/.next/static
COPY --from=builder --chown=app:app /build/web-cloud/public ./web-cloud/public

USER app
EXPOSE 3000

# Standalone server.js sits at <traceRoot>/web-cloud/server.js
WORKDIR /app/web-cloud
CMD ["node", "server.js"]
