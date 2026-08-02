import express from "express";

const PORT_A = 4000;
const PORT_B = 4001;

const serverB = express();
serverB.use(express.json());

serverB.post("/jobs", (req, res) => {
  const { jobId, payload, callbackUrl } = req.body;
  console.log(`[Server B] received job ${jobId}, payload:`, payload);

  // Respond right away
  res.status(202).json({ jobId, status: "accepted" });

  startWork(jobId, payload, callbackUrl);
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
});

type Payload = {
  value: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startWork(jobId: string, payload: Payload, callbackUrl: string) {
  await wait(2000);
  const result = { doubled: payload.value * 2 };
  console.log(`[Server B] job ${jobId} finished, calling back:`, result);

  await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, status: "completed", result }),
  });
}
