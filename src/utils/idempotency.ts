// src/utils/idempotency.ts

import { redis } from "../redis/redisConnection"

export async function acquireJobExecution(jobId: string) {

  const key = `job:${jobId}:lock`

  const result = await redis.set(
    key,
    "1",
    "EX",
    3600,
    "NX",
  )

  return result === "OK"
}