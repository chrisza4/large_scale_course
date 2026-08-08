import {
  insertJob,
  claimDueJobs,
  markCompleted,
  markRetrying,
  markFailed,
  getJob,
  type JobRow,
} from "./db";
import { sendEvent } from "./sendEvent";
import {
  PORT_B,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  POLL_INTERVAL_MS,
  MOCK_WORK_MS,
  FAILURE_PROBABILITY,
} from "./config";
import { withCors, corsPreflight } from "./cors";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

        insertJob.run({
          $jobId: jobId,
          $payload: JSON.stringify(payload),
          $callbackUrl: callbackUrl,
          $now: now,
        });

        console.log("[System B] accepted job " + jobId);

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
      GET: (req) => {
        const job = getJob.get({ $jobId: req.params.jobId });
        if (!job) return withCors(new Response("Not found", { status: 404 }));
        return withCors(Response.json(job));
      },
    },
  },
});

console.log("[System B] listening on http://localhost:" + PORT_B);

let isPolling = false;

async function pollAndProcess() {
  if (isPolling) return;
  isPolling = true;

  try {
    const now = new Date().toISOString();
    // Note: ClaimDueJobs is atomic, and need some tinkering with AI
    const claimedJobs = claimDueJobs.all({ $now: now }) as JobRow[];

    for (const job of claimedJobs) {
      await processJob(job);
    }
  } finally {
    isPolling = false;
  }
}

async function processJob(job: JobRow) {
  const jobId = job.jobId;
  const attempt = job.attempts;

  console.log(
    "[System B] processing job " +
      jobId +
      " (attempt " +
      attempt +
      "/" +
      MAX_ATTEMPTS +
      ")",
  );

  sendEvent({
    type: "processing",
    jobId: jobId,
    timestamp: new Date().toISOString(),
    source: "B",
    attempt: attempt,
    maxAttempts: MAX_ATTEMPTS,
  });

  await wait(MOCK_WORK_MS);

  const failed = Math.random() < FAILURE_PROBABILITY;

  if (!failed) {
    markCompleted.run({ $jobId: jobId, $now: new Date().toISOString() });

    console.log("[System B] job " + jobId + " completed");

    sendEvent({
      type: "completed",
      jobId: jobId,
      timestamp: new Date().toISOString(),
      source: "B",
      attempt: attempt,
      maxAttempts: MAX_ATTEMPTS,
    });

    await callback(job.callbackUrl, { jobId: jobId, status: "completed" });
    return;
  }

  if (attempt < MAX_ATTEMPTS) {
    const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();

    markRetrying.run({
      $jobId: jobId,
      $nextAttemptAt: nextAttemptAt,
      $lastError: "mock failure",
      $now: new Date().toISOString(),
    });

    console.log(
      "[System B] job " + jobId + " failed, will retry at " + nextAttemptAt,
    );

    sendEvent({
      type: "retrying",
      jobId: jobId,
      timestamp: new Date().toISOString(),
      source: "B",
      attempt: attempt,
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: nextAttemptAt,
    });
    return;
  }

  markFailed.run({
    $jobId: jobId,
    $lastError: "max attempts exceeded",
    $now: new Date().toISOString(),
  });

  console.log(
    "[System B] job " +
      jobId +
      " permanently failed after " +
      attempt +
      " attempts",
  );

  sendEvent({
    type: "failed",
    jobId: jobId,
    timestamp: new Date().toISOString(),
    source: "B",
    attempt: attempt,
    maxAttempts: MAX_ATTEMPTS,
    error: "max attempts exceeded",
  });

  await callback(job.callbackUrl, {
    jobId: jobId,
    status: "failed",
    error: "max attempts exceeded",
  });
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
      "[System B] failed to reach callback url:",
      (err as Error).message,
    );
  }
}

setInterval(pollAndProcess, POLL_INTERVAL_MS);
