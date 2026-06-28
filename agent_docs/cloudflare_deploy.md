# Cloudflare Workers Deploy

## When to load

Load this guide when preparing, previewing, or deploying the Excalidraw web app to Cloudflare Workers with Wrangler.

For backend/service responsibilities, also load `agent_docs/backend_services.md`.

## Deployment shape

This repo deploys the Vite-built Excalidraw app as Cloudflare Workers Static Assets.

| Item | Value |
| --- | --- |
| Wrangler config | `wrangler.jsonc` |
| Worker name | `excalidraw` |
| Custom domain | `draw.nikitayugov.com` |
| Build command | `yarn cf:build` |
| Asset directory | `excalidraw-app/build` |
| SPA fallback | `not_found_handling = single-page-application` |

No custom Worker entrypoint is required for the current setup. Add one only if the app needs edge logic such as headers, redirects, auth gates, API routes, or request-time environment behavior.

The production Worker is attached to `draw.nikitayugov.com` as a Cloudflare Custom Domain. Custom Domains are exact hostnames, so do not add `/*` to the route pattern.

## First-time setup

Run from the repository root:

```sh
yarn
npx --yes wrangler login
```

The repo currently uses `npx --yes wrangler` in scripts so the setup works even when Wrangler is not committed as a dependency. For a fully pinned deploy toolchain, add Wrangler as a root dev dependency:

```sh
yarn add --dev -W wrangler
```

If that command succeeds, keep the resulting `package.json` and `yarn.lock` changes together.

## Local preview

Build first, then serve with the local Workers runtime:

```sh
yarn cf:build
yarn cf:dev
```

`wrangler dev` reads `wrangler.jsonc` and serves `excalidraw-app/build` with the same SPA fallback used in production.

## Deploy

Dry-run the deploy package:

```sh
yarn cf:deploy:dry-run
```

Deploy to Cloudflare:

```sh
yarn cf:deploy
```

The deploy command rebuilds the Vite app before publishing.

## GitHub Actions deploy

Cloudflare deploy is automated by `.github/workflows/deploy-cloudflare.yml`.

The workflow only deploys from the `master-fork` branch:

```yaml
on:
  push:
    branches:
      - master-fork
```

Add these repository Actions secrets in GitHub:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account/workspace ID used by Wrangler |
| `CLOUDFLARE_API_TOKEN` | API token with permissions to deploy the Worker and manage its route/custom domain |

The workflow exposes those secrets as environment variables for Wrangler:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Do not commit account IDs or API tokens into `wrangler.jsonc`, `.env`, or docs.
Use GitHub Actions Secrets for CI and local shell environment variables for
local deploys.

## Environment and secrets

Most `VITE_APP_*` values are compile-time inputs loaded by Vite from root `.env*` files, not runtime Worker secrets. Changing them requires a rebuild.

Wrangler reads Cloudflare deployment credentials from process environment
variables:

```sh
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."
```

For GitHub Actions, use repository secrets with the same names instead of
committing a `.env` file.

Use Wrangler secrets only after adding a custom Worker script that reads runtime bindings:

```sh
npx --yes wrangler secret put SOME_SECRET
```

## Landmines

- Do not deploy before `yarn cf:build`; `wrangler.jsonc` points to `excalidraw-app/build`.
- Do not run automated deploys from branches other than `master-fork`.
- Do not commit `.wrangler/`; it is local Wrangler state and is ignored.
- Do not commit Cloudflare credentials; CI must use Actions Secrets.
- Keep `not_found_handling` enabled for SPA routes and share links.
- Cloudflare must own the `nikitayugov.com` zone, and `draw.nikitayugov.com` cannot already have a conflicting CNAME record when Wrangler creates the Custom Domain.
- Cloudflare deploy does not replace backend services such as `excalidraw-room`, `excalidraw-store`, Firebase, library submit, or AI infrastructure.
