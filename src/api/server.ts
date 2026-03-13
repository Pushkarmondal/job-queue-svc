import express from "express";
import { v4 as uuid } from "uuid";
import { redis } from "../redis/redisConnection";
import { getMetrics } from "./metrics";

const app = express();
const PORT = 3004;
const STREAM_KEY = "job";

app.use(express.json());  

app.post("/jobs", async (req, res) => {
  const job = {
    id: uuid(),
    type: req.body.type,
    payload: req.body.payload,
    attempts: 0,
    maxAttempts: 3,
    createdAt: Date.now(),
  };
  await redis.xadd(
    STREAM_KEY,
    "*",
    "data",
    JSON.stringify(job)
  )
  res.json({jobId: job.id})
});

app.get("/metrics", async (req, res) => {
  const metrics = await getMetrics()
  res.json(metrics)
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
