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

**The server needs a tenant roots file before it starts.** In the default `enforce` mode it refuses to start without one (`auth.missing-tenant-roots`), and no root key ships in the image. Put a JSON file of the form `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }` in the `cognate-data` volume, holding your own operator root public keys, and set `COGNATE_TENANT_ROOTS_PATH` to its path in the container, for example through a `docker-compose.override.yml`. The shipped `docker-compose.yml` does not set it.

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

The health body is:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

`mode` is `api` because the image runs `@cognate/node`. `serverTime` is what signed clients sync their clock to. Every write and every `GET /events/:eventId` must be signed; the [README's migration guide](https://github.com/mcp-tool-shop-org/cognate#authentication--migration-guide) shows how. The `cognate-data` volume is mounted at `/app/data`. The process writes the event log at `/app/data/events.jsonl` and three snapshots under `/app/data/cognate/`: `registry.json`, `agents.json`, and `prompts.json`. A restart reads those snapshots back. Attestia uses the same event-log variable on its own volume. RepoMesh's image does not mount this log.

The same Dockerfile is what GitHub pushes to `ghcr.io/mcp-tool-shop-org/cognate` when a release is published.
