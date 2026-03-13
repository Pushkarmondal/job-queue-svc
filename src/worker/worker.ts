import { redis } from "../redis/redisConnection";

const STREAM = "jobs";
const GROUP = "workers";
const CONSUMER = "worker-1";
const BLOCK = "BLOCK" as const;

async function processJob(job: any) {
  console.log("Processing job: ", job.id);
  await new Promise((r) => setTimeout(r, 2000));
  console.log("Finished processing job: ", job.id);
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
      } catch (error) {
        console.error("Error processing job: ", error);
      }
    }
  }
}

main();
