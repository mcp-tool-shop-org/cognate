---
title: Getting started
description: Install the Cognate workspace, verify the build, and run the health container.
sidebar:
  order: 1
---

The published package is `@mcptoolshop/cognate`. This repository is the pnpm workspace behind it. Node 22 or newer, and pnpm 10.28.2.

## Verify the libraries

```bash
pnpm install
pnpm verify
```

`pnpm verify` builds every package, runs the tests, and typechecks. `pnpm test:coverage` writes the coverage report.

There is no global binary. Import the package you need from the workspace, or depend on it from your own package once you publish a consumer.

## Run the image

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

The health body is:

```json
{ "status": "ok", "service": "cognate", "mode": "api" }
```

`mode` is `api` because the image runs `@cognate/node`. The `cognate-data` volume is mounted at `/app/data`. The server keeps its records in memory and does not write that volume yet.

The same Dockerfile is what GitHub pushes to `ghcr.io/mcp-tool-shop-org/cognate` when a release is published.
