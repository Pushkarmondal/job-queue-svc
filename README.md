# redis-job-queue

Distributed job processing with Redis Streams, Node.js & PostgreSQL.

---

## Overview

A minimal but production-realistic job queue built on Redis Streams. Jobs are enqueued via an Express API, processed by consumer group workers, retried with exponential backoff on failure, and persisted to PostgreSQL for audit history. Dead-letter queuing (DLQ) ensures no job silently disappears.

---

## Architecture

```
Client
  ↓
API Service (server.ts)
  ↓
Redis Stream  ←  append-only event log
  ↓
Worker Consumer Group (worker.ts)
  ↓
Job Processing
  ↓
ACK success  /  Retry with backoff  /  DLQ if max retries exceeded
  ↓
Postgres (job history)
```

| Component | Role |
|---|---|
| `api/server.ts` | Enqueues jobs via `XADD` to the Redis Stream |
| Redis Stream | Durable, ordered event log; source of truth for pending jobs |
| `worker/worker.ts` | Consumer group member; reads, processes, and ACKs jobs |
| `retry/retryScheduler.ts` | Polls `XPENDING`, re-delivers stalled jobs with backoff |
| DLQ | Catches jobs exceeding max retries; prevents silent loss |
| PostgreSQL | Persists job history — status, attempts, timestamps |

---

## Project Structure

```
redis-job-queue/
├── src/
│   ├── api/
│   │   └── server.ts              — Express HTTP layer, job ingestion
│   ├── worker/
│   │   └── worker.ts              — XREADGROUP consumer, job executor
│   ├── retry/
│   │   └── retryScheduler.ts      — XPENDING poller, backoff logic
│   ├── redis/
│   │   └── client.ts              — Shared ioredis instance
│   ├── types/
│   │   └── job.ts                 — Job interface & status enums
│   └── utils/
│       └── backoff.ts             — Exponential backoff calculator
└── docker-compose.yml             — Redis + Postgres local dev stack
```

---

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) 1.0+, Docker & Docker Compose

```bash
git clone <repo-url> && cd redis-job-queue

bun install

docker-compose up -d                          # start Redis & Postgres

bun run src/api/server.ts                     # terminal 1
bun run src/worker/worker.ts                  # terminal 2
bun run src/retry/retryScheduler.ts           # terminal 3
```

**Enqueue a job:**

```bash
curl -X POST http://localhost:3000/jobs \
  -H 'Content-Type: application/json' \
  -d '{"type": "email", "payload": {"to": "user@example.com"}}'
```

---

## Key Design Decisions

**Why Redis Streams over Redis Lists?**
Streams are an append-only log — messages survive consumer crashes. `XPENDING` lets the retry scheduler find unacknowledged messages without data loss, and consumer groups allow multiple workers to share load without duplicate processing.

**Retry & DLQ flow:**
The retry scheduler polls `XPENDING` on a fixed interval. If a job has been pending beyond the visibility timeout, it is re-delivered. After max retries (default: 3) it is moved to a dead-letter stream and flagged in Postgres — giving operators a clear audit trail without blocking healthy jobs.

**Exponential backoff:**
`backoff.ts` computes delay as `base * 2^attempt` with optional jitter, preventing thundering-herd retries when a downstream dependency recovers.

---

## Tradeoffs

| Decision | Upside | Cost |
|---|---|---|
| Redis Streams as queue | Simple ops; no extra broker | No built-in message routing or topic fanout |
| Consumer groups | Horizontal scaling; at-least-once delivery | Exactly-once requires idempotent job handlers |
| In-process retry scheduler | No extra service to deploy | Scheduler outage delays retries |
| Postgres for history | SQL queries, existing infra | Extra write per job |
| Single stream per job type | Simple routing | Head-of-line blocking if one type stalls |

---

## Future: BullMQ

BullMQ is a battle-tested queue library built on ioredis. Migrating would add:

- **Job priorities** — high-priority jobs jump the queue without a separate stream
- **Cron / repeatable jobs** — built-in scheduler replaces `retryScheduler.ts`
- **Rate limiting** — per-queue concurrency and rate caps out of the box
- **Bull Board UI** — real-time dashboard for job status, retries, DLQ
- **Sandboxed workers** — workers in child processes; crashes don't kill the main process
- **Delayed jobs** — schedule jobs to run at a future timestamp natively

Migration is low-friction: BullMQ uses Redis under the hood and the job handler interface maps closely to the `worker.ts` pattern here.

---

## Future: Kafka/BullMQ

For high-throughput or multi-team environments:

| | Redis Streams | Kafka/BullMQ |
|---|---|---|
| Throughput | Hundreds of thousands msg/s | Millions msg/s with partitioning |
| Retention | Memory-bound | Disk-based; days to forever |
| Replay | Manual (`XRANGE`) | First-class; seek to any offset |
| Multi-team fanout | Requires separate streams | Topics with independent consumer groups |
| Ordering | Per-stream | Per-partition |
| Operational cost | Low (existing Redis) | High (brokers, KRaft, Schema Registry) |


---

*redis-job-queue — built for learning, designed to scale*