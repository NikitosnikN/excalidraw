# AGENTS.md

## Critical Rules

- NEVER edit generated build output under `dist/`, `build/`, `types/`, coverage, or dependency folders.
- NEVER bypass `Scene`, `Store`, `mutateElement`, or restoration helpers when changing canvas elements; element ordering, versions, and fractional indices matter.
- NEVER treat collaboration or share-link data as plaintext. Room data and files are encrypted with room keys before Firebase/socket exchange.
- ALWAYS use Yarn 1 from the repo root unless a command explicitly targets a workspace with `yarn --cwd`.
- ALWAYS prefer file-scoped Vitest runs while iterating, then run broader checks before handoff.
- ALWAYS update snapshots intentionally with `yarn test:update`; do not accept snapshot churn blindly.
- ALWAYS keep app-specific features in `excalidraw-app/` and reusable editor/library behavior in `packages/excalidraw/` or lower packages.
- ALWAYS add or update an ADR under `adr/` when a new feature introduces a meaningful product, architecture, data, security, deployment, or integration decision.

## Project Overview

Excalidraw is an open-source, hand-drawn style virtual whiteboard. This repository contains both the reusable React editor package (`@excalidraw/excalidraw`) and the production web app used by `excalidraw.com`.

Technically, this is a Yarn workspaces TypeScript monorepo. The core editor is package-first, with app-only concerns such as Firebase persistence, socket.io collaboration, Sentry, PWA behavior, and share dialogs isolated in `excalidraw-app/`.

## Tech Stack

| Area | Details |
| --- | --- |
| Runtime | Node `>=18.0.0`; current package manager is `yarn@1.22.22` |
| Language | TypeScript `5.9.3`, React `19.0.0`, SCSS |
| App build | Vite `5.0.12`, Vite PWA, Vite React plugin |
| Packages build | custom Node scripts in `scripts/buildBase.js`, `scripts/buildPackage.js`, `scripts/buildUtils.js` |
| Tests | Vitest `3.0.6`, jsdom, Testing Library, snapshot tests |
| Quality | ESLint via `@excalidraw/eslint-config`, Prettier via `@excalidraw/prettier-config` |
| App services | Firebase `11.3.1`, socket.io-client `4.7.2`, Sentry `9.0.1`, Jotai `2.11.0` |

## Critical Commands

Run from repository root unless noted.

| Task | Command |
| --- | --- |
| Install dependencies | `yarn` |
| Start local app | `yarn start` |
| Build app | `yarn build` |
| Build Cloudflare assets | `yarn cf:build` |
| Preview Cloudflare Worker locally | `yarn cf:dev` |
| Deploy to Cloudflare Workers | `yarn cf:deploy` |
| Build all packages | `yarn build:packages` |
| Type-check repo | `yarn test:typecheck` |
| Lint TS/JS | `yarn test:code` |
| Check formatting | `yarn test:other` |
| Run all non-app quality checks | `yarn test:typecheck && yarn test:code && yarn test:other` |
| Run all tests once | `yarn test:app --watch=false` |
| Run one test file | `yarn test:app packages/element/tests/frame.test.tsx --watch=false` |
| Update snapshots | `yarn test:update` |
| Auto-fix formatting/lint | `yarn fix` |
| Start docs | `yarn --cwd dev-docs start` |
| Docker app | `docker-compose up --build -d` |

Note: this checkout currently has no `node_modules/`. Install dependencies before running TypeScript, lint, test, or build commands.

## Core Standards

| Rule | Use |
| --- | --- |
| Package boundaries | Put reusable editor behavior in `packages/excalidraw/`; geometric/element logic in `packages/element/`; pure math in `packages/math/`; app-only persistence/collab in `excalidraw-app/`. |
| Imports | Use workspace aliases such as `@excalidraw/element` and `@excalidraw/common`; aliases are defined in `tsconfig.json` and `vitest.config.mts`. |
| Element mutation | Prefer `scene.mutateElement(...)`, `mutateElement(...)`, or `newElementWith(...)`; do not mutate element objects ad hoc. |
| Undo/history | Choose the correct `CaptureUpdateAction` from `packages/element/src/store.ts`: `IMMEDIATELY`, `EVENTUALLY`, or `NEVER`. |
| Scene data | Preserve deleted elements where required; many APIs distinguish all elements from non-deleted elements. |
| Frames | Keep frame children before the frame element itself; renderer clipping assumes this ordering. |
| Tests | Co-locate focused tests near the owning package (`packages/*/tests`, `packages/*/*.test.tsx`, `excalidraw-app/tests`). |
| Styles | Component SCSS lives beside package/app components; shared theme variables are in `packages/excalidraw/css/`. |

Example element update pattern:

```ts
// Good: goes through scene mutation and preserves versioning/store expectations.
scene.mutateElement(element, { x: nextX, y: nextY });

// Bad: direct mutation can bypass caches, deltas, history, and collab reconciliation.
element.x = nextX;
```

## Safety & Permissions

- Safe local edits: TypeScript, tests, SCSS, docs, examples, package source files.
- Ask before: dependency upgrades, lockfile rewrites, release scripts, Docker publishing, Firebase/security rule changes, Sentry/tracking behavior, public API exports.
- Avoid unless explicitly requested: `yarn release*`, publishing packages/images, deleting snapshots, changing generated font/wasm assets.
- Local collaboration needs a separate collab server (`excalidraw-room`) and environment configuration.

## Progressive Disclosure Map

| When you need... | Load |
| --- | --- |
| Package/module boundaries and dependency flow | `agent_docs/architecture.md` |
| Directory map and source ownership | `agent_docs/code_structure.md` |
| Setup, local app, docs, package builds, Docker | `agent_docs/building_and_running.md` |
| Cloudflare Workers/Wrangler deploy setup | `agent_docs/cloudflare_deploy.md` |
| Backend/external services and self-hosting responsibilities | `agent_docs/backend_services.md` |
| Test strategy and file-scoped commands | `agent_docs/tests.md` |
| UI components, SCSS, themes, icons, localization | `agent_docs/design_system.md` |
| Realtime collaboration, Firebase, encrypted rooms | `agent_docs/flow_collaboration.md` |
| `.excalidraw` JSON, import/export, files, images | `agent_docs/flow_import_export.md` |

## Existing Human Docs

- `README.md` describes the product and package usage.
- `CONTRIBUTING.md` links to the developer docs.
- `dev-docs/docs/introduction/development.mdx` covers local setup.
- `dev-docs/docs/codebase/json-schema.mdx` documents the file format.
- `dev-docs/docs/codebase/frames.mdx` documents frame ordering.
- `adr/` stores Architecture Decision Records for new feature decisions.
