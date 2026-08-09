// Shared Redis connection + BullMQ Queue for the payments queue. Imported
// by both the server/worker process and the bull-board dashboard.

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { REDIS_URL, QUEUE_NAME } from "./config";

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const paymentsQueue = new Queue(QUEUE_NAME, { connection });
