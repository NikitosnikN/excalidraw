# 0001: Persistent Room Storage

## Status

Proposed

## Date

2026-06-28

## Context

The hosted Excalidraw app should gain persistent room storage without requiring
login before the user can start drawing.

The first implementation target is single-device usage without realtime
collaboration. The design must still leave room for later multi-device use,
user accounts, encrypted snapshots, and alternate storage backends.

The current deployment plan separates frontend delivery from the persistence
API:

- SPA origin: `https://draw.nikitayugov.com`
- Persistence API origin: `https://api-draw.nikitayugov.com`
- Frontend room path: `/r/:roomId`
- API namespace: `/api/rooms`

The initial backend stack is a standalone Cloudflare Worker API implemented
with Hono and backed by Cloudflare KV. The application should not hard-code KV
semantics into frontend or domain-level persistence code.

Related docs:

- `AGENTS.md`
- `agent_docs/backend_services.md`
- `agent_docs/cloudflare_deploy.md`
- `agent_docs/flow_collaboration.md`

## Decision

Implement anonymous persistent rooms backed by a separate Cloudflare Worker API.

The MVP backend uses:

- Cloudflare Workers as the API runtime;
- Hono as the HTTP routing framework;
- TypeScript;
- Cloudflare KV as the first room metadata and snapshot backend;
- Web Crypto API for token generation and token hashing;
- Wrangler for local development and deployment.

When a user opens `https://draw.nikitayugov.com/` without a room path, the app
creates a new persistent room and redirects to:

```text
https://draw.nikitayugov.com/r/:roomId
```

Room creation is explicit and happens through the API:

```text
POST https://api-draw.nikitayugov.com/api/rooms
```

The API creates:

- a unique `roomId`;
- a single read/write `storageAccessToken`;
- room metadata;
- an initial empty snapshot;
- `revision = 1`;
- initial `contentHash`;
- timestamps.

The initial implementation stores only Excalidraw scene data:

```ts
type ExcalidrawSceneSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};
```

Snapshots are wrapped in a versioned envelope. The MVP may store plaintext JSON,
but the interface must remain envelope/blob-oriented so encryption can be added
later without changing the API shape:

```ts
type RoomSnapshotEnvelope = {
  version: 1;
  encoding: "json";
  encryption: "none";
  payload: ExcalidrawSceneSnapshot;
};
```

### API Shape

Use command-style REST:

```text
POST /api/rooms
GET  /api/rooms/:roomId/snapshot
PUT  /api/rooms/:roomId/snapshot
PUT  /api/rooms/:roomId/config
```

The SPA reads the API origin from:

```text
VITE_APP_PERSISTENCE_API_URL=https://api-draw.nikitayugov.com
```

Example create response:

```json
{
  "roomId": "room_abc123",
  "storageAccessToken": "sat_secret",
  "config": {
    "name": null,
    "updatedAt": "2026-06-28T00:00:00.000Z"
  },
  "snapshot": {
    "revision": 1,
    "contentHash": "sha256:...",
    "updatedAt": "2026-06-28T00:00:00.000Z",
    "envelope": {
      "version": 1,
      "encoding": "json",
      "encryption": "none",
      "payload": {
        "elements": [],
        "appState": {},
        "files": {}
      }
    }
  }
}
```

### Room Configuration

Each persistent room has a small mutable configuration record owned by the API.
The MVP config contains only an optional human-readable room name:

```ts
type RoomConfig = {
  name: string | null;
  updatedAt: string;
};
```

Room names are display metadata only:

- not part of the Excalidraw scene snapshot;
- not included in `contentHash`;
- not used for authorization;
- not required to be unique;
- not used in the URL path.

The default room name is `null`. The client may render a fallback such as
`Untitled room` or a shortened `roomId`, but fallback labels are presentation
state and should not be persisted unless the user explicitly renames the room.

Room names must be sanitized and bounded by the API:

```text
trim whitespace
empty string => null
maximum length: 120 Unicode code points
store as plain text only
render as textContent, never as HTML
```

Updating the room name uses the same read/write `storageAccessToken` as snapshot
updates:

```http
PUT /api/rooms/:roomId/config
Authorization: Bearer sat_...
Content-Type: application/json
```

```json
{
  "name": "Architecture sketch"
}
```

Response:

```json
{
  "roomId": "room_abc123",
  "config": {
    "name": "Architecture sketch",
    "updatedAt": "2026-06-28T00:00:00.000Z"
  }
}
```

Config updates do not increment the snapshot `revision`. For the single-device
MVP, room config writes may use last-write-wins semantics. If multi-device
editing of room metadata becomes important, add a separate `configRevision`
field rather than overloading the scene snapshot revision.

Example save request:

```json
{
  "baseRevision": 3,
  "force": false,
  "contentHash": "sha256:...",
  "snapshot": {
    "version": 1,
    "encoding": "json",
    "encryption": "none",
    "payload": {
      "elements": [],
      "appState": {},
      "files": {}
    }
  }
}
```

Example conflict response:

```json
{
  "error": "conflict",
  "currentRevision": 4,
  "currentContentHash": "sha256:..."
}
```

### Persistence Abstraction

Use two logical persistence layers.

`RoomRepository` owns room metadata, access token verification, revision state,
content hash, and timestamps:

```ts
interface RoomRepository {
  createRoom(input: CreateRoomInput): Promise<RoomRecord>;
  getRoom(roomId: string): Promise<RoomRecord | null>;
  verifyAccessToken(roomId: string, token: string): Promise<boolean>;
  updateRoomConfig(input: UpdateRoomConfigInput): Promise<RoomRecord>;
  updateRoomRevision(input: UpdateRoomRevisionInput): Promise<RoomRecord>;
}
```

`SnapshotBlobStorage` owns snapshot envelope storage:

```ts
interface SnapshotBlobStorage {
  getSnapshot(roomId: string): Promise<RoomSnapshotEnvelope | null>;
  putSnapshot(roomId: string, snapshot: RoomSnapshotEnvelope): Promise<void>;
}
```

For the Cloudflare KV MVP, both layers may use the same KV namespace, but they
must remain separate in code. This keeps the path open for:

- room metadata in D1/Postgres;
- snapshot payloads in R2/S3;
- realtime session state in Durable Objects;
- encryption without changing the room API.

KV is accepted as a pragmatic MVP storage backend. Because KV is optimized for
global low-latency reads and is not a strongly consistent per-room coordinator,
revision conflict handling is best-effort in the KV-only version. If the app
needs stronger multi-device write serialization, introduce a Durable Object per
room before adding realtime collaboration.

### Backend Package Layout

Place the API Worker in its own package under the repository:

```text
workers/
  excalidraw-extended-api/
    package.json
    wrangler.jsonc
    src/
      index.ts
      routes/
        rooms.ts
      services/
        roomService.ts
      repositories/
        roomRepository.ts
        snapshotBlobStorage.ts
      storage/
        kvRoomRepository.ts
        kvSnapshotBlobStorage.ts
      auth/
        accessToken.ts
      rate-limit/
        policies.ts
      schemas/
        roomSchemas.ts
      types/
        room.ts
    test/
      rooms.test.ts
```

The route layer should stay thin. Hono handlers parse requests, call
`RoomService`, and format JSON responses. Business rules such as token
verification, content hashing, revision checks, and force-overwrite rules belong
in the service layer.

### Deployment Topology

Deploy the persistence API as a separate Worker from the SPA asset Worker.

Production:

```text
Worker package: workers/excalidraw-extended-api
Worker name: excalidraw-extended-api
Route/domain: https://api-draw.nikitayugov.com
Allowed SPA origin: https://draw.nikitayugov.com
KV binding: PERSISTENCE_KV
Secret: TOKEN_HASH_PEPPER
```

Development and preview deployments must not share production KV data:

```text
Preview Worker name: excalidraw-extended-api-preview
Preview KV binding: PERSISTENCE_KV
Preview KV namespace: separate Cloudflare KV namespace
Local secret file: workers/excalidraw-extended-api/.dev.vars
Example secret file: workers/excalidraw-extended-api/.dev.vars.example
```

`TOKEN_HASH_PEPPER` must be configured through Wrangler secrets for deployed
environments and must not be committed.

GitHub Actions deploys must read Cloudflare credentials from repository secrets
and expose them as Wrangler environment variables:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The SPA build points to the API through:

```text
VITE_APP_PERSISTENCE_API_URL=https://api-draw.nikitayugov.com
```

For local development, the SPA may point to the local API Worker:

```text
VITE_APP_PERSISTENCE_API_URL=http://localhost:8788
```

### CORS Policy

Because the API Worker is on a separate origin, every browser request must pass
through a strict CORS policy.

Production policy:

```text
Allowed origins: https://draw.nikitayugov.com
Allowed methods: GET, POST, PUT, OPTIONS
Allowed headers: Authorization, Content-Type
Credentials: false
```

Local development may additionally allow:

```text
http://localhost:3000
http://localhost:5173
http://127.0.0.1:5173
```

The API uses bearer tokens instead of cookies, so CORS must not enable
credentialed requests. This avoids adding CSRF concerns to the anonymous access
model.

### KV Data Model

Use one aggregate KV key per room for the KV-only MVP:

```text
room:{roomId}
```

This minimizes KV reads and writes for the initial implementation. The logical
`RoomRepository` and `SnapshotBlobStorage` abstractions remain separate in code
even though the physical KV record is one aggregate value.

Record shape:

```ts
type PersistedRoomAggregateV1 = {
  recordVersion: 1;
  roomId: string;
  tokenHash: string;
  config: {
    name: string | null;
    updatedAt: string;
  };
  revision: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  lastWriteAt: string;
  snapshot: RoomSnapshotEnvelope;
};
```

The API must reject unsupported `recordVersion` or `snapshot.version` values
with a stable error instead of trying to parse unknown data shapes.

### Error Contract

All API errors should use the same JSON envelope:

```ts
type ApiErrorResponse = {
  error:
    | "invalid_request"
    | "missing_token"
    | "invalid_token"
    | "room_not_found"
    | "conflict"
    | "payload_too_large"
    | "rate_limited"
    | "unsupported_version"
    | "internal_error";
  message: string;
  requestId: string;
  retryAfterSeconds?: number;
  currentRevision?: number;
  currentContentHash?: string;
};
```

Status mapping:

| Status | Error |
| --- | --- |
| `400` | `invalid_request`, `unsupported_version` |
| `401` | `missing_token` |
| `403` | `invalid_token` |
| `404` | `room_not_found` |
| `409` | `conflict` |
| `413` | `payload_too_large` |
| `429` | `rate_limited` |
| `500` | `internal_error` |

### Observability And Logging

Enable Cloudflare Workers observability for the API Worker. Logs must be useful
for debugging operational issues without exposing room contents or access keys.

Allowed log fields:

```text
requestId
method
route pattern
status
durationMs
roomId prefix or roomId hash
error code
rate limit outcome
payload size
```

Forbidden log fields:

```text
storageAccessToken
Authorization header
tokenHash
snapshot payload
raw Excalidraw elements
URL hash accessKey
```

Generate or propagate a `requestId` for every request and include it in error
responses.

### Local Development Commands

Expose root-level scripts that delegate into the Worker package:

```text
yarn worker:persistence:dev
yarn worker:persistence:test
yarn worker:persistence:deploy
yarn worker:persistence:deploy:dry-run
```

The Worker package should also have local scripts:

```text
yarn dev
yarn test
yarn deploy
yarn deploy:dry-run
```

Local development uses `workers/excalidraw-extended-api/.dev.vars`:

```env
TOKEN_HASH_PEPPER=dev-only-secret-change-me
```

Commit only `.dev.vars.example`.

### Anonymous Access Model

Rooms start without login. Access is controlled by a capability token:

```text
roomId = public room identifier in the path
storageAccessToken = private read/write access key
```

The client stores room access in a local registry:

```ts
type PersistentRoomRegistry = {
  version: 1;
  rooms: Record<
    string,
    {
      storageAccessToken: string;
      lastOpenedAt: string;
      roomName?: string;
      lastKnownRevision?: number;
      lastKnownContentHash?: string;
    }
  >;
};
```

Storage key:

```text
localStorage["persistentRooms"]
```

Every snapshot request sends the token as a bearer token:

```http
Authorization: Bearer sat_...
```

The API must never store access tokens in plaintext. It stores only a hash:

```text
tokenHash = HMAC_SHA256(storageAccessToken, TOKEN_HASH_PEPPER)
```

`TOKEN_HASH_PEPPER` is a Cloudflare Worker secret.

For the MVP, a single token grants both read and write access. There is no
read-only token, owner/admin role, per-device revocation, or recovery flow.

### Private Access Link

The UI provides a "Copy private access link" action:

```text
https://draw.nikitayugov.com/r/:roomId#accessKey=sat_...
```

The access key lives in the URL hash so it is not sent to the backend as part of
normal HTTP navigation. The link is still equivalent to full read/write room
access and must be labeled accordingly in the UI.

When a user opens a private access link on a new device, the app must ask for
confirmation before importing the key:

```text
Import access to this room on this device?
Anyone using this browser profile will be able to open and edit this room.
```

If confirmed:

1. Read `accessKey` from the hash.
2. Verify it with `GET /api/rooms/:roomId/snapshot`.
3. Store it in `localStorage["persistentRooms"]`.
4. Remove the hash from the address bar.
5. Open the snapshot.

If declined:

1. Do not store the token.
2. Remove the hash from the address bar.
3. Show the locked/import state.

When a user opens `/r/:roomId` without a stored token, the app shows an import
flow instead of creating a new room or showing an empty scene.

### Save Strategy

Use a conservative save model for the MVP:

- autosave with a 60-second debounce;
- manual save button;
- manual save clears any pending autosave debounce;
- no guaranteed async save on `beforeunload` for MVP.

Autosave must never silently overwrite a newer backend snapshot.

Manual save starts with strict optimistic concurrency, but after a conflict the
user may explicitly force overwrite.

### Rate Limiting And KV Write Guards

Use Cloudflare Workers Rate Limiting bindings for request throttling. Do not
implement request counters in KV, because that would create extra KV traffic for
the very load the limiter is meant to reduce.

Initial limits:

| Operation | Key | Limit | Purpose |
| --- | --- | --- | --- |
| `POST /api/rooms` | `create:{ip}` | `5/min` | Limit anonymous room creation abuse |
| `GET /api/rooms/:roomId/snapshot` | `read:{roomId}:{tokenHash}` | `60/min` | Limit polling or reload loops |
| `PUT /api/rooms/:roomId/snapshot` | `write:{roomId}:{tokenHash}` | `6/min` | Protect KV from frequent writes |
| `PUT /api/rooms/:roomId/config` | `write:{roomId}:{tokenHash}` | `6/min` | Share the room write budget |

Example Wrangler bindings:

```jsonc
{
  "ratelimits": [
    {
      "name": "ROOM_CREATE_LIMITER",
      "namespace_id": "1001",
      "simple": { "limit": 5, "period": 60 }
    },
    {
      "name": "ROOM_READ_LIMITER",
      "namespace_id": "1002",
      "simple": { "limit": 60, "period": 60 }
    },
    {
      "name": "ROOM_WRITE_LIMITER",
      "namespace_id": "1003",
      "simple": { "limit": 6, "period": 60 }
    }
  ]
}
```

For `GET` and `PUT`, hash the bearer token before rate limiting:

```ts
const tokenHash = await hashAccessToken(bearerToken, env.TOKEN_HASH_PEPPER);

const result = await env.ROOM_WRITE_LIMITER.limit({
  key: `write:${roomId}:${tokenHash}`,
});

if (!result.success) {
  return c.json({ error: "rate_limited" }, 429);
}
```

Rate limiting should happen before expensive parsing and before KV access when
the limiter key can be computed from the request path and bearer token.

Add domain-level guards in `RoomService`:

- reject snapshot payloads above the MVP size limit, initially `5 MiB`;
- reject same-content saves as no-ops when `contentHash` equals the current
  room `contentHash`;
- reject autosave conflicts with `409 Conflict`;
- reject writes that occur too soon after the previous accepted write, initially
  less than `5s` for the same room;
- pause autosave on the client after `429` until user action or backoff.

These limits are operational guardrails, not authorization. A valid
`storageAccessToken` is still required for room reads and writes.

### Data Retention

For the MVP, rooms are retained indefinitely unless deleted manually through
operator tooling. There is no user-facing delete endpoint, automated expiry, or
backup/restore guarantee in this ADR.

This is acceptable for the first private deployment, but public usage should add
an explicit retention and deletion policy before inviting broad usage.

### Conflict Detection And Resolution

Use both revision and content hash:

```ts
type SnapshotVersion = {
  revision: number;
  contentHash: string;
  updatedAt: string;
};
```

The client tracks the base version it loaded:

```ts
type LoadedSnapshotBase = {
  baseRevision: number;
  baseContentHash: string;
};
```

On save:

- client sends `baseRevision`;
- backend compares it with the current room revision;
- if revisions differ and `force !== true`, backend returns `409 Conflict`;
- if save succeeds, backend increments revision and stores the new content hash.

On opening a room:

- load the cloud snapshot;
- compare it with local unsaved state using `contentHash`;
- if local and cloud differ, show a conflict dialog.

Conflict dialog options:

- `Load cloud version` - replace local state with the backend snapshot.
- `Keep local version` - keep local state active; the next manual save may
  overwrite after explicit confirmation.

No automatic merge is part of the MVP.

## Alternatives Considered

### Require Login Before Creating A Room

Rejected for MVP. It makes authorization cleaner, but weakens the core
Excalidraw-style flow where a user can open the app and immediately start
drawing.

### Store Plain Excalidraw Data Directly In A KV-Specific Shape

Rejected. The first implementation may use plaintext JSON, but the API and
domain model should treat snapshots as versioned envelopes so encryption and
alternate storage backends can be added later.

### Put The Access Token In Query Parameters

Rejected. Query parameters are more likely to appear in logs, referrers, copied
URLs, and browser history. The chosen private access link uses the URL hash.

### Store Access Tokens In Plaintext

Rejected. The API stores only an HMAC hash of the token with a Worker secret
pepper.

### Last Write Wins

Rejected. Last-write-wins is simpler, but it can silently destroy newer data
when a room is opened from multiple devices. The MVP uses optimistic concurrency
and explicit force overwrite for manual conflict resolution.

### Single Storage Interface

Rejected. A single storage interface would couple room metadata, auth state,
revision handling, and snapshot payload storage. The chosen two-layer model
keeps the implementation replaceable.

### Same Worker For SPA And API

Rejected for this feature. The persistent API should be deployable and evolvable
independently from static frontend delivery.

## Consequences

Benefits:

- Users can start without login.
- Every new session can redirect into a persistent room path.
- Room state survives reloads and can later be transferred between devices.
- The API is not tied to Cloudflare KV even though KV is the first backend.
- The token model is simple enough for MVP while remaining compatible with
  future user accounts.
- Conflict detection is already compatible with future multi-device workflows.

Tradeoffs:

- `localStorage` tokens are vulnerable to XSS.
- A copied private access link grants full read/write access.
- There is no account recovery if the user loses the access key.
- There is no read-only sharing.
- Cloudflare KV has value-size and write-frequency constraints; large embedded
  files may require R2 later.
- KV-only conflict handling is best-effort and should not be treated as a
  strong multi-device synchronization guarantee.
- Rate limits reduce abuse and accidental load, but they are not exact
  per-user accounting and should not replace authorization checks.
- Separate API and SPA Workers require CORS and two deployment targets.

Future work:

- add end-to-end encrypted snapshot envelopes;
- add user accounts and room ownership;
- add read-only or scoped tokens;
- add token rotation/revocation;
- add user-facing room deletion and retention controls;
- move large binary files to R2;
- add room history/version restore;
- add realtime collaboration through a separate service or Durable Objects;
- add stronger abuse controls, quotas, and bot protection if public usage grows.

## Implementation Notes

Frontend:

- add `/r/:roomId` routing;
- add bootstrap redirect from `/` to a newly created room;
- add `VITE_APP_PERSISTENCE_API_URL`;
- add a room registry wrapper around `localStorage["persistentRooms"]`;
- add room name display and rename UI backed by room config;
- add snapshot load/save integration with Excalidraw scene state;
- add a manual save button;
- add 60-second debounced autosave;
- add conflict dialog;
- add copy private access link UI;
- add confirm-before-import flow for `#accessKey=...`;
- clear imported access keys from the address bar after handling.

API Worker:

- create a separate Cloudflare Worker for `https://api-draw.nikitayugov.com`;
- implement the Worker as `workers/excalidraw-extended-api`;
- use Hono for routing and middleware;
- configure CORS for `https://draw.nikitayugov.com`;
- create a KV namespace for room metadata and snapshot envelopes;
- bind `TOKEN_HASH_PEPPER` as a Worker secret;
- configure Rate Limiting bindings for room creation, room reads, and room
  writes;
- implement `RoomRepository`;
- implement `SnapshotBlobStorage`;
- implement `POST /api/rooms`;
- implement `GET /api/rooms/:roomId/snapshot`;
- implement `PUT /api/rooms/:roomId/snapshot`;
- implement `PUT /api/rooms/:roomId/config`;
- return `401` or `403` for invalid access tokens;
- return `404` for missing rooms;
- return `429 Too Many Requests` for rate-limited requests;
- return `409 Conflict` for revision conflicts;
- enforce snapshot payload size and minimum write spacing;
- never log access tokens or snapshot payloads.

Test coverage:

- `POST /api/rooms` creates a room and an initial empty snapshot;
- `POST /api/rooms` returns the access token only in the create response;
- `GET /api/rooms/:roomId/snapshot` rejects missing tokens with `401`;
- `GET /api/rooms/:roomId/snapshot` rejects invalid tokens with `403`;
- `GET /api/rooms/:roomId/snapshot` returns `404` for missing rooms;
- `PUT /api/rooms/:roomId/snapshot` rejects invalid tokens with `403`;
- `PUT /api/rooms/:roomId/snapshot` increments revision on changed content;
- `PUT /api/rooms/:roomId/snapshot` treats same `contentHash` as a no-op;
- `PUT /api/rooms/:roomId/snapshot` returns `409` for stale `baseRevision`;
- `PUT /api/rooms/:roomId/snapshot` allows explicit `force: true`;
- `PUT /api/rooms/:roomId/config` updates the room name without changing
  snapshot revision;
- `PUT /api/rooms/:roomId/config` normalizes an empty name to `null`;
- room names are escaped/rendered as text, not HTML;
- payloads above the MVP limit return `413`;
- rate-limited requests return `429`;
- CORS preflight succeeds for `https://draw.nikitayugov.com`;
- CORS rejects unapproved origins;
- logs and error responses never include bearer tokens or snapshot payloads.

Non-goals for this ADR:

- realtime collaboration;
- Firebase/Firestore replacement;
- Excalidraw share-link backend replacement;
- public library hosting;
- user account system;
- read-only links;
- encrypted payload implementation;
- mobile-specific offline sync.
