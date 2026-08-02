import express from "express";
import { Database } from "bun:sqlite";

const PORT_A = 4000;
const PORT_B = 4001;

const serverB = express();
serverB.use(express.json());

serverB.post("/jobs", (req, res) => {
  const { jobId, payload, callbackUrl } = req.body;
  console.log(`[Server B] received job ${jobId}, payload:`, payload);

  insertJob.run({
    $jobId: jobId,
    $status: "pending",
    $payload: JSON.stringify(payload),
    $now: new Date().toISOString(),
  });

  // Respond right away
  res.status(202).json({ jobId, status: "accepted" });

  startWork(jobId, payload, callbackUrl);
});

serverB.get("/jobs/:jobId", (req, res) => {
  const job = getJob.get({ $jobId: req.params.jobId });
  if (!job) return res.sendStatus(404);
  res.json(job);
});

serverB.listen(PORT_B, () => {
  console.log(`[Server B] listening on http://localhost:${PORT_B}`);
});

const serverA = express();
serverA.use(express.json());

serverA.post("/callback", (req, res) => {
  console.log("[Server A] received callback:", req.body);
  res.sendStatus(200);
});

serverA.listen(PORT_A, async () => {
  console.log(`[Server A] listening on http://localhost:${PORT_A}`);

  const jobId = crypto.randomUUID();
  console.log(`[Server A] sending job ${jobId} to Server B...`);

  const response = await fetch(`http://localhost:${PORT_B}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      payload: { value: 21 },
      callbackUrl: `http://localhost:${PORT_A}/callback`,
    }),
  });

  console.log("[Server A] get response from Server B:", await response.json());
  console.log(
    "[Server A] I can on with other work while B processes in the background...",
  );

  // Poll job status stored in SQLite to demonstrate persistence
  const pollInterval = setInterval(async () => {
    const statusRes = await fetch(`http://localhost:${PORT_B}/jobs/${jobId}`);
    const job = (await statusRes.json()) as { status: string };
    console.log(`[Server A] job ${jobId} status from DB:`, job.status);
    if (job.status === "completed") clearInterval(pollInterval);
  }, 500);
});

type Payload = {
  value: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startWork(jobId: string, payload: Payload, callbackUrl: string) {
  try {
    updateJob.run({
      $jobId: jobId,
      $status: "in_progress",
      $result: null,
      $now: new Date().toISOString(),
    });

    await wait(2000);

    const result = { doubled: payload.value * 2 };
    console.log(`[Server B] job ${jobId} finished, calling back:`, result);

    updateJob.run({
      $jobId: jobId,
      $status: "completed",
      $result: JSON.stringify(result),
      $now: new Date().toISOString(),
    });

    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status: "completed", result }),
    });
  } catch (e) {
    const errorMessage = (e as Error).message;
    updateJob.run({
      $jobId: jobId,
      $status: "failed",
      $result: errorMessage,
      $now: new Date().toISOString(),
    });
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status: "failed", errorMessage }),
    });
  }
}

const db = new Database("jobs.sqlite");
db.run(`
  CREATE TABLE IF NOT EXISTS jobs (
    jobId TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    result TEXT,
    updatedAt TEXT NOT NULL
  )
`);

const insertJob = db.query(
  "INSERT INTO jobs (jobId, status, payload, result, updatedAt) VALUES ($jobId, $status, $payload, NULL, $now)",
);
const updateJob = db.query(
  "UPDATE jobs SET status = $status, result = $result, updatedAt = $now WHERE jobId = $jobId",
);
const getJob = db.query("SELECT * FROM jobs WHERE jobId = $jobId");
