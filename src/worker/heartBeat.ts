import { redis } from "../redis/redisConnection"

export async function startHeartbeat(workerId: string) {

  while (true) {

    await redis.set(
      `worker:${workerId}`,
      Date.now(),
      "EX",
      30
    )

    await new Promise(r => setTimeout(r, 10000))
  }
}