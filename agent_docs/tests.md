# Tests

## Test Stack

- Vitest `3.0.6`
- jsdom environment
- Testing Library for React/component tests
- Snapshot tests stored under `__snapshots__/`
- Global setup in `setupTests.ts`

Vitest aliases in `vitest.config.mts` point workspace imports at source files, so tests exercise local package source rather than published `dist/`.

## Fast Iteration Commands

Use file-scoped tests first:

```bash
yarn test:app packages/element/tests/frame.test.tsx --watch=false
yarn test:app packages/excalidraw/components/TTDDialog/utils/mermaidValidation.test.ts --watch=false
yarn test:app excalidraw-app/tests/collab.test.tsx --watch=false
```

Then run the relevant broader checks:

```bash
yarn test:typecheck
yarn test:code
yarn test:other
```

For final full app tests:

```bash
yarn test:app --watch=false
```

## Root Scripts

| Script | Meaning |
| --- | --- |
| `yarn test` | Alias for `yarn test:app` and may watch by default. |
| `yarn test:app --watch=false` | Run Vitest once. |
| `yarn test:update` | Run tests once and update snapshots. |
| `yarn test:typecheck` | Run `tsc` with no emit. |
| `yarn test:code` | ESLint all JS/TS/TSX with zero warnings. |
| `yarn test:other` | Prettier list-different for CSS/SCSS/JSON/MD/HTML/YML. |
| `yarn test:all` | Typecheck, lint, formatting, then app tests once. |
| `yarn test:coverage` | Vitest coverage. |

## Where Tests Live

| Area | Test locations |
| --- | --- |
| Element model | `packages/element/tests/`, `packages/element/src/__tests__/` |
| Math | `packages/math/tests/` |
| Common utilities | `packages/common/tests/`, `packages/common/src/*.test.ts` |
| Editor package | `packages/excalidraw/tests/`, colocated `*.test.tsx` |
| App shell/collab | `excalidraw-app/tests/` |
| Utils package | `packages/utils/tests/` |

## Snapshot Rules

- Update snapshots only when the expected UI/serialization/rendering behavior changed.
- Use `yarn test:update` for intentional updates.
- Review snapshot diffs; do not accept broad churn caused by unrelated formatting, locale, or ordering changes.

## Common Landmines

- Many tests rely on element ordering and deleted-element handling. Preserve all-elements vs non-deleted-elements distinctions.
- Store/history behavior depends on `CaptureUpdateAction`; tests may pass locally but regress undo/collab if the wrong action is used.
- Canvas/jsdom tests rely on mocks from `setupTests.ts` and `vitest-canvas-mock`.
- Some CI checks require maintainer approval on external PRs; local command success is still the best handoff signal.

## Current Validation Note

At documentation-generation time, `node_modules/` was missing in this checkout. Commands were discovered from `package.json` and config files, but full test/typecheck execution requires `yarn` first.
