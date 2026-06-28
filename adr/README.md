# Architecture Decision Records

This directory stores Architecture Decision Records (ADRs) for new features.

Create an ADR when a feature introduces a meaningful product, architecture, data, security, deployment, or integration decision that future maintainers should understand before changing the code.

## Naming

Use this format:

```text
NNNN-short-feature-or-decision-name.md
```

Examples:

```text
0001-cloudflare-worker-deploy.md
0002-new-collaboration-flow.md
```

## Statuses

- `Proposed` - under discussion.
- `Accepted` - approved and ready to implement.
- `Superseded` - replaced by a newer ADR.
- `Rejected` - considered but intentionally not adopted.

## Template

Copy `0000-template.md` for new records.

## Records

| ADR | Status | Topic |
| --- | --- | --- |
| [0001-persistent-room-storage.md](0001-persistent-room-storage.md) | Proposed | Anonymous persistent rooms, storage API, access tokens, and conflict handling |

## Rules

- Keep each ADR focused on one decision.
- Prefer concrete tradeoffs over broad prose.
- Link to source files, issues, pull requests, or docs when they matter.
- Update the ADR if implementation discovers a materially different decision.
