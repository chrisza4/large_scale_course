import { Mutex } from "async-mutex";

type IdempotencyEntry = { mutex: Mutex; value?: number };
const store = new Map<string, IdempotencyEntry>();

function getEntry(key: string): IdempotencyEntry {
  let entry = store.get(key);
  if (!entry) {
    entry = { mutex: new Mutex() };
    store.set(key, entry);
  }
  return entry;
}

// ── Server ────────────────────────────────────────────────────────────────────

let counter = 0;

const server = Bun.serve({
  port: 3000,
  routes: {
    "/increment": {
      POST: async (req) => {
        const key = req.headers.get("Idempotency-Key");
        if (!key) {
          return new Response("Missing Idempotency-Key header", {
            status: 400,
          });
        }

        const entry = getEntry(key);

        // Important: Idempotency check must be atomic
        // Excersise for reader: Can you implement this as distributed lock in Redis?
        return entry.mutex.runExclusive(async () => {
          if (entry.value !== undefined) {
            return Response.json({ counter: entry.value, cached: true });
          }

          if (Math.random() < 0.01) {
            console.log(`[server] Simulating timeout for key ${key}`);
            await Bun.sleep(2000);
            if (Math.random() < 0.5) {
              // Simulate actual network error where server do nothing
              return Response.json({ error: "timeout error" }, { status: 500 });
            }
          }

          entry.value = ++counter;
          return Response.json({ counter: entry.value, cached: false });
        });
      },
    },
  },
});

console.log(`[server] Listening on http://localhost:${server.port}`);

// ── Client ────────────────────────────────────────────────────────────────────

type RequestResult = {
  status: "incremented" | "cached" | "failed";
  attempts: number;
};

async function incrementWithRetry(maxRetries = 5): Promise<RequestResult> {
  const key = crypto.randomUUID();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`http://localhost:${server.port}/increment`, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        signal: AbortSignal.timeout(1000),
      });

      if (res.ok) {
        const data = (await res.json()) as { counter: number; cached: boolean };
        return {
          status: data.cached ? "cached" : "incremented",
          attempts: attempt,
        };
      }
    } catch {
      // timeout or network error — retry with same key
    }

    if (attempt < maxRetries) await Bun.sleep(200);
  }

  return { status: "failed", attempts: maxRetries };
}

// Give the server a tick to bind before the client fires
await Bun.sleep(10);

const TOTAL = 1000;
const CONCURRENCY = 100;
const results: RequestResult[] = [];

console.log(`[client] Sending ${TOTAL} requests (${CONCURRENCY} at a time)…\n`);

for (let i = 0; i < TOTAL; i += CONCURRENCY) {
  const batch = Array.from({ length: Math.min(CONCURRENCY, TOTAL - i) }, () =>
    incrementWithRetry(),
  );
  results.push(...(await Promise.all(batch)));
}

const retried = results.filter((r) => r.attempts > 1).length;
const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);

console.log(`\n
Results (${TOTAL} requests)        
- requests that retried: ${String(retried).padStart(3)}
- total HTTP attempts:  ${String(totalAttempts).padStart(4)}
- final counter value: ${String(counter).padStart(5)}
`);

server.stop();
