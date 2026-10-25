# cognate: how it works

Mapped at 2026-10-25 from commit b9b7ba2 by Atlas 1.24.0.

## What this is

14 parts, mostly TypeScript (78 files), JavaScript (3), CSS (2) and Astro (1). Work enters through 5 doors; CI, Publish to GHCR and Release each reach 9 parts, and CI is followed because a pull request goes through it. It publishes @mcptoolshop/cognate to npm and a container image. It deploys a site to GitHub Pages. People import @mcptoolshop/cognate.

## What changed since 2026-10-24 (8db9173)

- scripts now imports node.
- CI now also runs packages/node/tests/deploy-gate.test.ts, packages/node/tests/evaluations.test.ts, packages/node/tests/event-proof.test.ts and 7 more.
- CI no longer runs packages/node/tests/.
- Docker Publish (.github/workflows/docker-publish.yml) is no longer a door.
- And 4 more changes to doors.
- Dockerfile is now read by .github/workflows/ci.yml and packages/node/tests/signed-requests.test.ts.
- HANDBOOK.md is now read by packages/node/tests/signed-requests.test.ts.
- README.md is now read by packages/node/tests/signed-requests.test.ts.
- And 7 more new writers and readers of places.
- 5 files added, 1 removed and 48 changed content, across 12 parts.

## What comes in

1. **CI.** On a pull request to main touching 6 paths; on a push to main touching 6 paths; or by hand. Runs scripts/make-tenant-root.mjs, packages/agent-identity/tests/, packages/model-registry/tests/ and 13 more; builds packages/cognate/src/agent-identity.ts, packages/cognate/src/index.ts, packages/cognate/src/model-registry.ts and 43 more.
2. **Publish to GHCR.** When a release is published; on a `workflow_call` event; or by hand. Runs packages/node/src/index.ts; builds packages/agent-identity/src/, packages/model-registry/src/, packages/node/src/ and 12 more; packs package.json, packages/, packages/agent-identity/package.json and 10 more into an image.
3. **Release.** When a tag matching `v*` is pushed. Runs packages/node/src/index.ts, packages/agent-identity/tests/, packages/cognate/tests/ and 18 more; builds packages/cognate/src/agent-identity.ts, packages/cognate/src/index.ts, packages/cognate/src/model-registry.ts and 43 more; packs package.json, packages/, packages/agent-identity/package.json and 10 more into an image.
4. **Deploy site to GitHub Pages.** On a push to main touching 2 paths; or by hand. Runs site/astro.config.mjs and site/src/.
5. **@mcptoolshop/cognate** (the package people import). Loads packages/cognate/dist/index.d.ts, built from a source this map cannot place.

## What happens through CI

1. The workflow runs packages/agent-identity/tests/ in agent-identity, packages/model-registry/tests/ in model-registry, 9 files in node, packages/policy/tests/ in policy, packages/prompt-store/tests/ in prompt-store, and scripts/make-tenant-root.mjs in scripts; it builds 7 files in cognate, packages/agent-identity/src/ in agent-identity, packages/model-registry/src/ in model-registry, packages/node/src/ in node, packages/policy/src/ in policy, and 9 files in 3 more parts.

## Who reads the results

CI writes nothing this map can see.

## The other doors

**Publish to GHCR** runs packages/node/src/index.ts, builds packages/agent-identity/src/, packages/model-registry/src/, packages/node/src/ and 12 more, packs package.json, packages/, packages/agent-identity/package.json and 10 more into an image, and publishes a container image on a tag push.

**Release** runs packages/node/src/index.ts, packages/agent-identity/tests/, packages/cognate/tests/ and 18 more, builds packages/cognate/src/agent-identity.ts, packages/cognate/src/index.ts, packages/cognate/src/model-registry.ts and 43 more, packs package.json, packages/, packages/agent-identity/package.json and 10 more into an image, publishes @mcptoolshop/cognate to npm and a container image, and creates a GitHub release.

**Deploy site to GitHub Pages** runs site/astro.config.mjs and site/src/, and deploys the site.

**@mcptoolshop/cognate** (the package people import) loads packages/cognate/dist/index.d.ts, built from a source this map cannot place.

## What breaks what

- **types** is imported by 6 parts (agent-identity, cognate, model-registry, node, policy, prompt-store) and sits on the path of 3 doors.
- **agent-identity** is imported by 2 parts (cognate, node) and sits on the path of 3 doors.
- **model-registry** is imported by 2 parts (cognate, node) and sits on the path of 3 doors.
- **policy** is imported by 2 parts (cognate, node) and sits on the path of 3 doors.
- **prompt-store** is imported by 2 parts (cognate, node) and sits on the path of 3 doors.
- **repomesh-bridge** is imported by 2 parts (cognate, node) and sits on the path of 3 doors.
- **node** is imported by 1 part (scripts) and sits on the path of 3 doors.
- **cognate** is imported by no other part and sits on the path of 3 doors.

## What tends to change together

No two source files changed together often enough to name.

Window: 180 days; a pair counts from 3 shared commits, since 0 source files reach 10 revisions; the floor rises to 10 when 25 do.

## What no test touches

- **scripts** is imported by no test.

## Written but never read

No place this map can see is written, so none goes unread.

## Helpers that look duplicated

No two parts export a helper that looks alike.

## Generated, never hand-edited

Nothing in this repository writes to a tracked place this map can see.

## Hand-authored

People write .github/, docs/, the repository root, site/ and specs/. Nothing in this repository writes to them.

## Where to start

.github/workflows/ci.yml → packages/agent-identity/src/index.ts → packages/agent-identity/src/identity.ts → packages/types/src/index.ts

Read those in order to follow one pull request end to end.

## What this map cannot see

- 2 reads use paths built at run time and are not named here.
- 5 writes and 21 reads go to a path their caller passes, not to this repository.
- 3 reads go to the directory the command is run in, not to this repository.
- Statistics confidence is low: fewer than 25 source files reach 10 revisions in the window.

Regenerate with `npx --yes @dogfood-lab/atlas map`.
