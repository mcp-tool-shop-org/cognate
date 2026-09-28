---
title: Getting started
description: Install the Cognate workspace, verify the build, and run the health container.
sidebar:
  order: 1
---

Cognate is a pnpm workspace. It is not an npm package named `cognate`. Node 22 or newer, and pnpm 10.28.2.

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
{ "status": "ok", "service": "cognate", "mode": "placeholder" }
```

`mode` is `placeholder` because the governance HTTP API is not in this image. The container exists so the build is supervised and the `cognate-data` volume is mounted at `/app/data`. v0.1.0 does not write prompt or agent files there yet.

The same Dockerfile is what GitHub pushes to `ghcr.io/mcp-tool-shop-org/cognate` when a release is published.
