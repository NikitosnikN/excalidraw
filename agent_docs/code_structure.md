# Code Structure

## Top-Level Map

| Path | What lives here |
| --- | --- |
| `package.json` | Workspace list, root scripts, shared dev dependencies, package manager pin. |
| `tsconfig.json` | Strict TypeScript config and workspace path aliases. |
| `vitest.config.mts` | Vitest jsdom setup and source aliases for workspaces. |
| `setupTests.ts` | Global test setup. |
| `excalidraw-app/` | Production web app wrapper around the editor package. |
| `packages/` | Published and internal packages. |
| `examples/` | Consumer integration examples. |
| `dev-docs/` | Docusaurus docs site. |
| `scripts/` | Package/app build, release, locale, changelog, wasm/font scripts. |
| `firebase-project/` | Firebase rules/config used by app services. |
| `public/` | Static assets for the app. |
| `.github/workflows/` | CI for test, lint, Docker, release, coverage, locales, PR title. |
| `agent_docs/` | AI-agent technical guides, including backend/service responsibility docs. |
| `adr/` | Architecture Decision Records for meaningful feature, integration, deployment, or security decisions. |

## `packages/excalidraw/`

| Path | Purpose |
| --- | --- |
| `index.tsx` | Public package entrypoint. |
| `components/App.tsx` | Main editor component. |
| `components/canvases/` | Static, interactive, and new-element canvas layers. |
| `actions/` | Command/action handlers for editor operations. |
| `data/` | JSON/blob/image/filesystem/encryption/restore/reconcile/library helpers. |
| `scene/` | Scene-level rendering/export helpers and selected-element logic. |
| `renderer/` | Rendering internals. |
| `hooks/` | Editor hooks. |
| `locales/` | i18n source files and percentages. |
| `css/` | Shared package styles, themes, variables. |
| `components/TTDDialog/` | Text-to-diagram, Mermaid, chat UI, validation/fix helpers. |
| `tests/` and `*.test.tsx` | Package-focused tests. |

Use this package for reusable editor behavior and public package APIs.

## `packages/element/`

| Path | Purpose |
| --- | --- |
| `src/types.ts` | Element type definitions. |
| `src/Scene.ts` | Scene container, element maps, non-deleted caches, selection cache. |
| `src/store.ts` | Store snapshots, deltas, undo/history capture actions. |
| `src/mutateElement.ts` | Canonical element mutation helpers. |
| `src/newElement.ts` | Element construction. |
| `src/frame.ts` | Frame membership/order behavior. |
| `src/binding.ts` | Bound text/arrows and element bindings. |
| `src/renderElement.ts` | Element rendering. |
| `src/linearElementEditor.ts` | Line/arrow point editing and binding interactions. |
| `tests/` | Element behavior tests. |

Use this package when behavior is about the element model rather than React UI.

## `excalidraw-app/`

| Path | Purpose |
| --- | --- |
| `index.tsx`, `App.tsx` | App entry and shell. |
| `collab/` | Collaboration API, socket portal, error UI. |
| `data/firebase.ts` | Firebase persistence for scenes/files. |
| `data/LocalData.ts` | Browser-local scene persistence. |
| `data/FileManager.ts` | Image/file save/load state. |
| `data/tabSync.ts` | Cross-tab browser state/version sync. |
| `share/` | Share dialog and QR code UI. |
| `app-language/` | Language list, detection, state. |
| `components/` | App-only components and integrations. |
| `tests/` | App-level tests. |

Use this directory for excalidraw.com-specific behavior. Do not add app service dependencies to lower packages.

## Lower Packages

| Package | Key files |
| --- | --- |
| `packages/common/` | `src/constants.ts`, `src/colors.ts`, `src/keys.ts`, `src/utils.ts`, `src/appEventBus.ts`. |
| `packages/math/` | `src/point.ts`, `src/vector.ts`, `src/line.ts`, `src/curve.ts`, `src/rectangle.ts`, `src/ellipse.ts`. |
| `packages/utils/` | `src/export.ts`, `src/shape.ts`, test utilities. |
| `packages/laser-pointer/` | `src/state.ts`, `src/simplify.ts`, `src/math.ts`. |
| `packages/fractional-indexing/` | `src/index.ts`. |

## Import Patterns

Prefer workspace aliases:

```ts
import { mutateElement } from "@excalidraw/element";
import { arrayToMap } from "@excalidraw/common";
```

Avoid deep relative imports across package boundaries. The repo config maps aliases to source for local tests and to `dist/` through package exports for published packages.

## Documentation Locations

- Human setup docs: `dev-docs/docs/introduction/development.mdx`
- Human contribution docs: `dev-docs/docs/introduction/contributing.mdx`
- Data schema: `dev-docs/docs/codebase/json-schema.mdx`
- Frame ordering: `dev-docs/docs/codebase/frames.mdx`
