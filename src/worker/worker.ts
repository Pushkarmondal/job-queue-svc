import { redis } from "../redis/redisConnection";
import { acquireJobExecution } from "../utils/idempotency";

const STREAM = "jobs";
const DLQ_STREAM = "jobs.dlq"

const GROUP = "workers";
const CONSUMER = "worker-1";
const BLOCK = "BLOCK" as const;

async function processJob(job: any) {
  console.log("Processing job: ", job.id);
  
  if(Math.random() < 0.3) {
    throw new Error("Random failure");
  }
  const allowed = await acquireJobExecution(job.id)
  
    if (!allowed) {
      console.log("Duplicate job skipped:", job.id)
      return
    }

  
  await new Promise((r) => setTimeout(r, 2000));
  console.log("Finished processing job: ", job.id);
}

async function sendToDLQ(job: any, error: any) {
  const failedJob = {
    ...job,
    failedAt: Date.now(),
    error: error.message
  }
  await redis.xadd(
    DLQ_STREAM,
    "*",
    "data",
    JSON.stringify(failedJob)
  )
}

async function retryJob(job: any) {
  job.attempts += 1;
  await redis.xadd(
    STREAM,
    "*",
    "data",
    JSON.stringify(job)
  )
  console.log("Retry scheduled:", job.id)
}

async function main() {
  while (true) {
    const result = await redis.xreadgroup(
      "GROUP",
      GROUP,
      CONSUMER,
      "COUNT",
      1,
      BLOCK,
      5000,
      "STREAMS",
      STREAM,
      ">"
    );
    if(!result) continue;
    if(!Array.isArray(result[0])) { continue }
    const [stream, messages] = result[0];
    for (const [id, fields] of messages) {
      const job = JSON.parse(fields[1]);
      
      try {
        await processJob(job);
        await redis.xack(STREAM, GROUP, id);
        console.log("Job processed successfully: ", job.id);
      } catch (error) {
        console.error("Error processing job: ", error);
        
        await redis.xack(STREAM, GROUP, id)
        
        if(job.attempts >= job.maxAttempts) {
          await sendToDLQ(job, error);
        } else {
          await retryJob(job);
        }
      }
    }
  }
}

main();
