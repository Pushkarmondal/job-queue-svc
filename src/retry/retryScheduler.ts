import { redis } from "../redis/redisConnection"

async function run() {

  while(true){

    const now = Date.now()

    const jobs = await redis.zrangebyscore(
      "retry_jobs",
      0,
      now
    )

    for(const job of jobs){

      await redis.xadd(
        "jobs",
        "*",
        "data",
        job
      )

      await redis.zrem("retry_jobs", job)
    }

    await new Promise(r => setTimeout(r, 5000))
  }
}

run()