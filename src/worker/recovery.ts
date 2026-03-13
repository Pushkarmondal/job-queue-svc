import { redis } from "../redis/redisConnection"

const STREAM = "jobs"
const GROUP = "workers"
const CONSUMER = "recovery-worker"

const IDLE_TIME = 60000   // 60s

type XAutoClaimMessage = [id: string, fields: string[]]
type XAutoClaimResult = [nextId: string, messages: XAutoClaimMessage[], deletedIds: string[]]

export async function recoverStalledJobs() {
  while (true) {
    const result = await redis.xautoclaim(
      STREAM,
      GROUP,
      CONSUMER,
      IDLE_TIME,
      "0-0",
      "COUNT",
      10
    ) as XAutoClaimResult

    const [, messages] = result

    for (const [id, fields] of messages) {

      const job = JSON.parse(fields[1]!)

      console.log("Recovered stalled job:", job.id)

      // push back to main stream for reprocessing
      await redis.xadd(
        STREAM,
        "*",
        "data",
        JSON.stringify(job)
      )

      await redis.xack(STREAM, GROUP, id)
    }

    await new Promise(r => setTimeout(r, 10000))
  }
}