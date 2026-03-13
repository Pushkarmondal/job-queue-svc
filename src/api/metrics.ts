import { redis } from "../redis/redisConnection"

export async function getMetrics() {

  const streamLength = await redis.xlen("jobs")
  const dlqLength = await redis.xlen("jobs.dlq")
  const retryCount = await redis.zcard("retry_queue")

  return {
    jobs_in_stream: streamLength,
    dlq_size: dlqLength,
    scheduled_retries: retryCount
  }
}