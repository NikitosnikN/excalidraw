# Backend And External Services

## When to load

Load this guide when changing deployment, environment variables, share links, collaboration, Firebase, libraries, AI features, Excalidraw Plus integration, telemetry, or self-hosting behavior.

## Service Responsibility Map

Excalidraw is a static React/Vite SPA for the core drawing experience, but several optional app features call external services.

| Service | Config | Responsibility | Required for basic drawing? |
| --- | --- | --- | --- |
| Cloudflare Worker Static Assets | `wrangler.jsonc` | Serves the built SPA from `excalidraw-app/build` on `draw.nikitayugov.com`. | Yes for this deployment target |
| `excalidraw-store` / `json.excalidraw.com` | `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL` | Stores and returns encrypted readonly share-link blobs. | No |
| `excalidraw-room` / `oss-collab.excalidraw.com` | `VITE_APP_WS_SERVER_URL` | Socket.io realtime room relay for live collaboration. | No |
| Firebase Firestore | `VITE_APP_FIREBASE_CONFIG` | Durable encrypted snapshot storage for collaboration rooms. | No |
| Firebase Storage | `VITE_APP_FIREBASE_CONFIG` | Encrypted binary file/image storage for collaboration rooms and share-link files. | No |
| `excalidraw-libraries` / `libraries.excalidraw.com` | `VITE_APP_LIBRARY_URL` | Public catalog/static site for browsing and importing `.excalidrawlib` libraries. | No |
| Library submit backend | `VITE_APP_LIBRARY_BACKEND` | Receives library publish submissions from the app. | No |
| AI backend | `VITE_APP_AI_BACKEND` | Text-to-diagram and diagram-to-code generation endpoints. | No |
| Excalidraw Plus | `VITE_APP_PLUS_LP`, `VITE_APP_PLUS_APP`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` | Plus links, promo surfaces, and iframe/export integration. | No |
| Sentry | `VITE_APP_DISABLE_SENTRY`, hostname gating in `excalidraw-app/sentry.ts` | Browser error reporting for official online environments. | No |
| Analytics | `VITE_APP_ENABLE_TRACKING` and `window.sa_event` | Limited client-side event tracking. | No |

## Core Self-Hosted Modes

| Desired capability | Services needed |
| --- | --- |
| Local/private drawing only | Static SPA only. Browser localStorage/IndexedDB keep local scene/library state. |
| Readonly share links | Static SPA plus `excalidraw-store`-compatible GET/POST backend; Firebase Storage is also used for share-link image files. |
| Live collaboration | Static SPA plus `excalidraw-room`, Firebase Firestore, and Firebase Storage, or compatible replacements. |
| AI diagram generation | Static SPA plus an AI backend implementing the expected `/v1/ai/...` endpoints. |
| Browse public libraries | Static SPA can link to public `libraries.excalidraw.com`. |
| Publish libraries | Static SPA plus the library submit backend. |

## `excalidraw-store`

Repository: `https://github.com/excalidraw/excalidraw-store`

Purpose: readonly share-link object storage.

What it does:

- Accepts encrypted binary payloads from `exportToBackend()` via `POST /api/v2/post/`.
- Stores the payload in Google Cloud Storage under a generated id.
- Returns the id and public GET URL.
- Serves the stored binary payload through `GET /api/v2/:key`.
- Enforces payload size limits and CORS.

What it does not do:

- It does not serve live collaboration.
- It does not decrypt drawings.
- It does not understand Excalidraw scene JSON.
- It does not store room presence, cursors, or realtime state.

Relevant app code:

- `excalidraw-app/data/index.ts`
- `VITE_APP_BACKEND_V2_GET_URL`
- `VITE_APP_BACKEND_V2_POST_URL`

Security model:

- The app encrypts the scene client-side.
- The decryption key is put in the URL hash, for example `#json=<id>,<key>`.
- URL hashes are not sent in HTTP requests, so the store backend receives only the id and encrypted blob.

## `excalidraw-room`

Repository: `https://github.com/excalidraw/excalidraw-room`

Purpose: realtime socket.io relay for live collaboration.

What it does:

- Runs an Express/HTTP server with socket.io.
- Accepts browser socket.io connections from the Excalidraw app.
- Emits room lifecycle events such as `init-room`, `first-in-room`, `new-user`, and `room-user-change`.
- Relays encrypted room broadcasts between participants.
- Relays volatile updates such as cursors, idle status, and viewport/follow-user signals.

What it does not do:

- It does not persist rooms.
- It does not store uploaded images/files.
- It does not decrypt collaboration payloads.
- It does not replace Firestore or Firebase Storage.

Relevant app code:

- `excalidraw-app/collab/Collab.tsx`
- `excalidraw-app/collab/Portal.tsx`
- `excalidraw-app/app_constants.ts`
- `VITE_APP_WS_SERVER_URL`

Security model:

- The socket server sees room ids and encrypted binary payloads.
- Scene contents are encrypted client-side with the room key from `#room=<roomId>,<roomKey>`.

## Firebase Firestore And Storage

Purpose: durable encrypted collaboration persistence and binary file storage.

Firestore stores room snapshots:

- Collection: `scenes`
- Document id: room id
- Data shape: `sceneVersion`, `iv`, `ciphertext`
- Write path: `saveToFirebase()`
- Read path: `loadFromFirebase()`

Firebase Storage stores binary files:

- Collaboration files: `/files/rooms/{roomId}/{fileId}`
- Share-link files: `/files/shareLinks/{shareLinkId}/{fileId}`
- Files are compressed/encrypted before upload and decrypted client-side after download.

Relevant app code:

- `excalidraw-app/data/firebase.ts`
- `excalidraw-app/data/FileManager.ts`
- `excalidraw-app/collab/Collab.tsx`
- `firebase-project/firestore.rules`
- `firebase-project/storage.rules`
- `VITE_APP_FIREBASE_CONFIG`

Landmines:

- Firebase config is a compile-time Vite value, not a Cloudflare runtime secret.
- Changing Firebase config requires rebuilding the SPA.
- Firestore rules intentionally allow get/write but deny list; do not casually relax listing.
- Collaboration persistence is encrypted but public-write by room id. Treat the room key as the real access secret.

## `excalidraw-libraries`

Repository: `https://github.com/excalidraw/excalidraw-libraries`

Purpose: public library catalog and static assets for reusable `.excalidrawlib` collections.

What it contains:

- `libraries.json`: catalog metadata such as name, description, authors, source, preview, dates, version, and id.
- `.excalidrawlib` files and preview images.
- A static site served at `libraries.excalidraw.com`.
- Validation tooling for library catalog entries.

What it does not do:

- It is not the submit/review backend.
- It is not required for drawing, exporting, or live collaboration.
- It does not store user scenes or rooms.

Relevant app code:

- `packages/excalidraw/components/LibraryMenuBrowseButton.tsx`
- `packages/excalidraw/data/library.ts`
- `VITE_APP_LIBRARY_URL`

The app opens `VITE_APP_LIBRARY_URL` with target/referrer/token/theme/version query parameters so the library site can return selected library data to the Excalidraw window.

## Library Submit Backend

Purpose: receive library publish submissions.

The app posts a `FormData` payload to:

```txt
${VITE_APP_LIBRARY_BACKEND}/submit
```

Payload includes the exported library file, preview image, title, author fields, description, and social links.

Relevant app code:

- `packages/excalidraw/components/PublishLibrary.tsx`
- `VITE_APP_LIBRARY_BACKEND`

Production currently points to a Google Cloud Function under the Excalidraw Firebase project. This is separate from the public `excalidraw-libraries` static catalog.

## AI Backend

Purpose: AI-assisted generation features.

Expected endpoints:

- `POST /v1/ai/diagram-to-code/generate`
- `POST /v1/ai/text-to-diagram/chat-streaming`

Relevant app code:

- `excalidraw-app/components/AI.tsx`
- `packages/excalidraw/components/TTDDialog/`
- `VITE_APP_AI_BACKEND`

This backend is optional. If unavailable, disable or hide AI surfaces rather than letting UI actions fail at runtime.

## Excalidraw Plus Integration

Purpose: links and export integration with Excalidraw Plus.

Relevant app code:

- `excalidraw-app/ExcalidrawPlusIframeExport.tsx`
- `excalidraw-app/components/ExportToExcalidrawPlus.tsx`
- `excalidraw-app/components/ExcalidrawPlusPromoBanner.tsx`
- `VITE_APP_PLUS_LP`
- `VITE_APP_PLUS_APP`
- `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`

For self-hosted deployments, decide whether Plus links should remain public Excalidraw links, be hidden, or point to a private service.

## Telemetry

Sentry:

- Initialized in `excalidraw-app/sentry.ts`.
- Disabled when `VITE_APP_DISABLE_SENTRY=true`.
- Also gated by hostname; the official DSN is only used for known Excalidraw online hostnames.

Analytics:

- Implemented in `packages/excalidraw/analytics.ts`.
- Requires `VITE_APP_ENABLE_TRACKING=true`.
- Also requires a global `window.sa_event` provider.
- Tracks only an allowlisted subset of categories.

For private/self-hosted builds, default to disabling telemetry unless there is an explicit product decision and ADR.

## Deployment Notes For `draw.nikitayugov.com`

The Cloudflare Worker deployment only serves the SPA. It does not replace any of the external services above.

For a minimal first deploy:

- Keep drawing/export/import local.
- Disable Sentry/tracking if privacy is preferred.
- Leave Plus/library browse links as public links or hide them intentionally.
- Decide separately whether share links, collaboration, AI, and library publishing are in scope.

If enabling collaboration:

- Set `VITE_APP_WS_SERVER_URL` to your own `excalidraw-room` deployment or the public `oss-collab.excalidraw.com`.
- Set `VITE_APP_FIREBASE_CONFIG` to a Firebase project you control, or replace the Firebase code with a compatible backend.
- Rebuild after changing these values.

If enabling readonly share links:

- Set `VITE_APP_BACKEND_V2_GET_URL` and `VITE_APP_BACKEND_V2_POST_URL` to your own `excalidraw-store` deployment or compatible API.
- Keep Firebase Storage configured if share-link images/files should work.
