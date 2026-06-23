# External Integrations

**Analysis Date:** 2026-06-23

## APIs & External Services

**Local Daemon IPC:**

- fff-gpui Daemon - Native fuzzy finder / grep daemon
- SDK/Client: Native Node.js `node:net` module (Socket client)
- Auth: None (communicates locally via Unix socket at `~/.local/state/fff-gpui/fff-gpui.sock` or custom path)

## Data Storage

**Databases:**

- None

**File Storage:**

- Local filesystem only - Opens workspace documents via VS Code API

**Caching:**

- None

## Authentication & Identity

**Auth Provider:**

- None

## Monitoring & Observability

**Error Tracking:**

- None

**Logs:**

- Custom OutputChannel - Logs extension lifecycle and command invocation events via VS Code Window OutputChannel (`src/logger.ts`)

## CI/CD & Deployment

**Hosting:**

- VS Code Marketplace / Open VSX (packaged via `vsce package`, published via `vsce publish`)

**CI Pipeline:**

- None

## Environment Configuration

**Required env vars:**

- None

**Secrets location:**

- None

## Webhooks & Callbacks

**Incoming:**

- None

**Outgoing:**

- None

---

_Integration audit: 2026-06-23_
