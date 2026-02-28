# Kube Forwarder

A web-based Kubernetes port forwarding manager. Replaces `kubectl port-forward` with a persistent dashboard — forwards survive terminal sessions and are accessible from any device on the same network.

![Stack](https://img.shields.io/badge/NuxtJS-3-00DC82?style=flat) ![k8s](https://img.shields.io/badge/@kubernetes/client--node-0.22-326CE5?style=flat)

---

## Features

- **GUI dashboard** — create, monitor, and stop port forwards without the CLI
- **Pod & Service support** — forward directly to a pod or let the manager resolve the pod behind a service
- **LAN accessible** — binds to `0.0.0.0`; auto-detects the machine's local IP so forwarded ports work from any device on the network
- **Real-time updates** — live connection count, per-forward logs, and status via Server-Sent Events
- **Persistent across page reloads** — active forwards survive browser navigation (server-side state)
- **Port suggestions** — the modal auto-suggests ports defined on the selected resource

---

## Requirements

- Node.js ≥ 18
- A valid `~/.kube/config` with an accessible cluster
- The user running the server must have RBAC permission to `pods/portforward`

---

## Installation

```bash
cd kube-forwarder
npm install
```

---

## Usage

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000` with hot-module reloading.

### Production

```bash
npm run build
npm start
```

The server listens on port 3000. Access the dashboard from any device on the same network at `http://<host-ip>:3000`.

---

## How It Works

```
Browser  ──────────────────────────────────────────────────
            SSE /api/forwards/events   (real-time state)
            POST /api/forwards          (create forward)
            DELETE /api/forwards/:id    (stop forward)

Nitro Server (Node.js)  ───────────────────────────────────
  net.Server  :localPort  0.0.0.0
      │
      │  TCP socket (client connection)
      ▼
  k8s.PortForward  (WebSocket to kube-apiserver)
      │
      │  SPDY/WebSocket multiplexed streams
      ▼
  Pod :remotePort  (inside the cluster)
```

Each active forward is a `net.Server` instance listening on the configured local port. When a client connects, a new WebSocket is opened to the Kubernetes API server's port-forward endpoint and streams are piped bidirectionally.

---

## Project Structure

```
kube-forwarder/
├── server/
│   ├── utils/
│   │   ├── k8s.ts          # KubeConfig singleton, API client factory, local IP detection
│   │   └── forwarder.ts    # Port-forward manager — net.Server + k8s PortForward + SSE event bus
│   └── api/
│       ├── cluster.get.ts          # GET /api/cluster  — cluster info + local IP
│       ├── namespaces.get.ts       # GET /api/namespaces
│       ├── resources.get.ts        # GET /api/resources?namespace=&type=
│       └── forwards/
│           ├── index.get.ts        # GET  /api/forwards       — list all
│           ├── index.post.ts       # POST /api/forwards       — create
│           ├── [id].delete.ts      # DELETE /api/forwards/:id — stop
│           └── events.get.ts       # GET /api/forwards/events — SSE stream
├── composables/
│   └── useForwards.ts      # EventSource client + reactive state
├── components/
│   ├── ForwardCard.vue     # Per-forward card with port map, logs, connection count
│   └── AddForwardModal.vue # Create-forward form with namespace/resource/port pickers
└── pages/
    └── index.vue           # Main dashboard
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cluster` | Cluster name, context, server URL, local machine IP |
| `GET` | `/api/namespaces` | List all namespaces |
| `GET` | `/api/resources` | List pods or services in a namespace (`?namespace=&type=pod\|service`) |
| `GET` | `/api/forwards` | List active forwards |
| `POST` | `/api/forwards` | Create a forward (see body below) |
| `DELETE` | `/api/forwards/:id` | Stop and remove a forward |
| `GET` | `/api/forwards/events` | SSE stream of forward state changes |

### POST /api/forwards

```json
{
  "namespace":    "longhorn-system",
  "resourceType": "service",
  "resourceName": "longhorn-frontend",
  "localPort":    8080,
  "remotePort":   80
}
```

### SSE Event Types

| Type | Payload | Description |
|------|---------|-------------|
| `init` | `{ forwards: ForwardRule[] }` | Full state on connect |
| `add` | `{ forward: ForwardRule }` | New forward created |
| `remove` | `{ id: string }` | Forward stopped |
| `update` | `{ forward: ForwardRule }` | Status/error changed |
| `log` | `{ id, message }` | New log line |
| `stat` | `{ id, connections }` | Connection count update |

---

## Configuration

Copy `.env.example` to `.env` and edit as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the web UI listens on (dev and production) |
| `KUBE_CONFIG_PATH` | _(unset)_ | Explicit path to a kubeconfig file — takes priority over `KUBECONFIG` |
| `KUBECONFIG` | `~/.kube/config` | Standard kubectl env var — used when `KUBE_CONFIG_PATH` is not set |

### Examples

```bash
# Custom port
PORT=8888 npm run dev
PORT=8888 npm start

# Custom kubeconfig path
KUBE_CONFIG_PATH=/home/alice/.kube/prod.yaml npm start

# Multiple kubeconfigs (standard kubectl syntax — use first cluster found)
KUBECONFIG=/home/alice/.kube/config:/home/alice/.kube/prod.yaml npm start
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nuxt` | ^3.15 | Full-stack Vue framework (Nitro server + Vite frontend) |
| `@kubernetes/client-node` | ^0.22 | Kubernetes API client + PortForward WebSocket |
| `@nuxtjs/tailwindcss` | ^6.12 | Utility CSS |
| `@types/node` | ^25 | Node.js type declarations |
# KubeForwarding
