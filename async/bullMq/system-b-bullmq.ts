// System B (BullMQ variant): same job as visualized/system-b.ts — accept a
// job from System A, process it with retries, then call back — but the
// queueing/scheduling/retry bookkeeping is delegated to BullMQ (backed by
// Redis) instead of the hand-rolled sqlite polling loop. A bull-board
// dashboard is served alongside it so the queue can be inspected live.
//
// Requires a Redis server reachable at REDIS_URL (defaults to
// redis://localhost:6379).

import { Worker, type Job } from "bullmq";
import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { paymentsQueue, connection } from "./queue";
import { sendEvent } from "../visualized/sendEvent";
import { withCors, corsPreflight } from "../visualized/cors";
import {
  PORT_B,
  PORT_BULLBOARD,
  QUEUE_NAME,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  MOCK_WORK_MS,
  FAILURE_PROBABILITY,
} from "./config";

type JobData = { payload: unknown; callbackUrl: string };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callback(callbackUrl: string, body: object) {
  try {
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.log(
      "[System B/BullMQ] failed to reach callback url:",
      (err as Error).message,
    );
  }
}

Bun.serve({
  port: PORT_B,
  routes: {
    "/startProcessing": {
      OPTIONS: () => corsPreflight(),
      POST: async (req) => {
        const body = (await req.json()) as any;
        const jobId = body.jobId;
        const payload = body.payload;
        const callbackUrl = body.callbackUrl;
        const now = new Date().toISOString();

        await paymentsQueue.add(
          "process",
          { payload, callbackUrl } satisfies JobData,
          {
            jobId,
            attempts: MAX_ATTEMPTS,
            backoff: { type: "fixed", delay: RETRY_DELAY_MS },
            removeOnComplete: { age: 3600 },
            removeOnFail: { age: 3600 },
          },
        );

        console.log("[System B/BullMQ] accepted job " + jobId);

        sendEvent({
          type: "accepted",
          jobId: jobId,
          timestamp: now,
          source: "B",
        });

        return withCors(
          Response.json(
            { jobId: jobId, status: "accepted" },
            { status: 202 },
          ),
        );
      },
    },
    "/jobs/:jobId": {
      OPTIONS: () => corsPreflight(),
      GET: async (req) => {
        const job = await paymentsQueue.getJob(req.params.jobId);
        if (!job) return withCors(new Response("Not found", { status: 404 }));

        const state = await job.getState();
        return withCors(
          Response.json({
            jobId: job.id,
            payload: job.data.payload,
            callbackUrl: job.data.callbackUrl,
            status: state,
            attempts: job.attemptsMade,
            lastError: job.failedReason ?? null,
          }),
        );
      },
    },
  },
});

console.log("[System B/BullMQ] listening on http://localhost:" + PORT_B);

const worker = new Worker<JobData>(
  QUEUE_NAME,
  async (job: Job<JobData>) => {
    const attempt = job.attemptsMade + 1;

    console.log(
      "[System B/BullMQ] processing job " +
        job.id +
        " (attempt " +
        attempt +
        "/" +
        MAX_ATTEMPTS +
        ")",
    );

    sendEvent({
      type: "processing",
      jobId: job.id!,
      timestamp: new Date().toISOString(),
      source: "B",
      attempt: attempt,
      maxAttempts: MAX_ATTEMPTS,
    });

    await wait(MOCK_WORK_MS);

    if (Math.random() < FAILURE_PROBABILITY) {
      throw new Error("mock failure");
    }
  },
  { connection, concurrency: 5 },
);

worker.on("completed", async (job) => {
  console.log("[System B/BullMQ] job " + job.id + " completed");

  sendEvent({
    type: "completed",
    jobId: job.id!,
    timestamp: new Date().toISOString(),
    source: "B",
    attempt: job.attemptsMade,
    maxAttempts: MAX_ATTEMPTS,
  });

  await callback(job.data.callbackUrl, { jobId: job.id, status: "completed" });
});

worker.on("failed", async (job, err) => {
  if (!job) return;

  const attempt = job.attemptsMade;
  const willRetry = attempt < (job.opts.attempts ?? MAX_ATTEMPTS);

  if (willRetry) {
    const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();

    console.log(
      "[System B/BullMQ] job " + job.id + " failed, will retry at " + nextAttemptAt,
    );

    sendEvent({
      type: "retrying",
      jobId: job.id!,
      timestamp: new Date().toISOString(),
      source: "B",
      attempt: attempt,
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: nextAttemptAt,
    });
    return;
  }

  console.log(
    "[System B/BullMQ] job " +
      job.id +
      " permanently failed after " +
      attempt +
      " attempts",
  );

  sendEvent({
    type: "failed",
    jobId: job.id!,
    timestamp: new Date().toISOString(),
    source: "B",
    attempt: attempt,
    maxAttempts: MAX_ATTEMPTS,
    error: err.message,
  });

  await callback(job.data.callbackUrl, {
    jobId: job.id,
    status: "failed",
    error: err.message,
  });
});

// Bull-board dashboard, served over plain express on its own port.
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(paymentsQueue)],
  serverAdapter,
});

const dashboardApp = express();
dashboardApp.use("/admin/queues", serverAdapter.getRouter());
dashboardApp.listen(PORT_BULLBOARD, () => {
  console.log(
    "[System B/BullMQ] dashboard listening on http://localhost:" +
      PORT_BULLBOARD +
      "/admin/queues",
  );
});
