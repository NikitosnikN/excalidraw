# Building And Running

## Environment

- Node: `>=18.0.0` from root `package.json`.
- Package manager: `yarn@1.22.22`.
- This checkout currently has no `node_modules/`, so install dependencies before running build/test commands.

```bash
yarn
```

The current shell reported Node `v25.9.0`. The project only declares a minimum version, but if tooling behaves strangely, retry with a current LTS Node before changing code.

## Common Local Commands

| Task | Command |
| --- | --- |
| Start the web app | `yarn start` |
| Build the web app | `yarn build` |
| Preview production build | `yarn build:preview` |
| Build all packages | `yarn build:packages` |
| Build one package | `yarn build:element` or `yarn build:excalidraw` |
| Start docs site | `yarn --cwd dev-docs start` |
| Build docs site | `yarn --cwd dev-docs build` |
| Start script example | `yarn start:example` |

`yarn start` delegates to `excalidraw-app` and starts Vite. The documented local app URL is `http://localhost:3000`.

## Workspace Commands

The root workspace includes:

```json
[
  "excalidraw-app",
  "packages/*",
  "examples/*"
]
```

Use `yarn --cwd <path> <script>` when a command exists only in a workspace:

```bash
yarn --cwd excalidraw-app build
yarn --cwd dev-docs start
yarn --cwd examples/with-nextjs build
```

## Package Builds

Package builds generate `dist/` and type outputs:

- `packages/excalidraw`: `scripts/buildPackage.js` plus `tsc`
- `packages/utils`: `scripts/buildUtils.js` plus `tsc`
- other packages: `scripts/buildBase.js` plus `tsc`

Do not edit generated outputs. Fix source files and rebuild.

## Docker

Local Docker compose:

```bash
docker-compose up --build -d
```

Standalone client image:

```bash
docker build -t excalidraw/excalidraw .
docker run --rm -dit --name excalidraw -p 5000:80 excalidraw/excalidraw:latest
```

Self-hosted Docker app does not include sharing/collaboration features by itself.

## Collaboration Setup

Local collaboration requires a separate collab server from `excalidraw-room`. Do not assume `yarn start` enables production-like collaboration.

Relevant app files:

- `excalidraw-app/collab/Collab.tsx`
- `excalidraw-app/collab/Portal.tsx`
- `excalidraw-app/data/firebase.ts`
- `excalidraw-app/app_constants.ts`

## Cleaning

| Task | Command |
| --- | --- |
| Remove build outputs | `yarn rm:build` |
| Remove dependency folders | `yarn rm:node_modules` |
| Clean install | `yarn clean-install` |

Only run cleanup commands when explicitly useful. They can make later verification slower.
