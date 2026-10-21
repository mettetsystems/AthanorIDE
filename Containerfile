# syntax=docker/dockerfile:1.7

# Rootless-Podman-friendly multi-stage build for AthanorIDE.
# Prefer: podman compose -f compose.yaml up --build

############################
# API runtime
############################
FROM python:3.12-slim AS api

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/pyproject.toml apps/api/README.md ./
COPY apps/api/athanor_api ./athanor_api

RUN pip install --no-cache-dir .

EXPOSE 8000
USER nobody
CMD ["uvicorn", "athanor_api.main:app", "--host", "0.0.0.0", "--port", "8000"]

############################
# Web deps + build
############################
FROM node:22-bookworm-slim AS web-build

WORKDIR /repo
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
ARG ATHANOR_INTERNAL_API_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    ATHANOR_INTERNAL_API_URL=${ATHANOR_INTERNAL_API_URL}
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/node-definitions/package.json packages/node-definitions/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile=false

COPY packages ./packages
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @athanor/contracts build \
    && pnpm --filter @athanor/node-definitions build \
    && pnpm --filter @athanor/ui build \
    && pnpm --filter @athanor/web build

############################
# Web runtime
############################
FROM node:22-bookworm-slim AS web

WORKDIR /repo
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
ARG ATHANOR_INTERNAL_API_URL=http://127.0.0.1:8000
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    ATHANOR_INTERNAL_API_URL=${ATHANOR_INTERNAL_API_URL}

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=web-build /repo /repo

# OpenShift assigns a namespace-specific UID. Keep the Next runtime cache
# writable by the container's root group without requiring a privileged UID.
USER root
RUN chgrp -R 0 /repo/apps/web/.next && chmod -R g=u /repo/apps/web/.next
USER node

EXPOSE 3000
WORKDIR /repo/apps/web
ENV HOME=/tmp
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
