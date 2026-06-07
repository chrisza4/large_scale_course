// ── Idempotency store ────────────────────────────────────────────────────────

// Values are either the settled result or the in-flight promise for that key.
// Storing the promise makes the "claim" atomic (JS event loop is single-threaded
// between awaits), so concurrent requests for the same key await the same work.
const idempotencyStore = new Map<string, number | Promise<number>>();

type IdempotencyOutcome =
  | { cached: true; result: number }
  | { cached: false; resolve: (result: number) => void };

function claimOrJoin(key: string): IdempotencyOutcome | Promise<{ cached: true; result: number }> {
  const entry = idempotencyStore.get(key);

  if (entry !== undefined) {
    if (entry instanceof Promise) {
      return entry.then((result) => ({ cached: true as const, result }));
    }
    return { cached: true, result: entry };
  }

  // Atomically reserve this key before any await.
  let resolve!: (result: number) => void;
  const promise = new Promise<number>((res) => { resolve = res; });
  idempotencyStore.set(key, promise);
  promise.then((result) => idempotencyStore.set(key, result));

  return { cached: false, resolve };
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

        const outcome = await claimOrJoin(key);

        if (outcome.cached) {
          return Response.json({ counter: outcome.result, cached: true });
        }

        if (Math.random() < 0.01) {
          console.log(`[server] Simulating timeout for key ${key}`);
          await Bun.sleep(2000);
        }

        const result = ++counter;
        outcome.resolve(result);
        return Response.json({ counter: result, cached: false });
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

const incremented = results.filter((r) => r.status === "incremented").length;
const cached = results.filter((r) => r.status === "cached").length;
const failed = results.filter((r) => r.status === "failed").length;
const retried = results.filter((r) => r.attempts > 1).length;
const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);

console.log(`\n
┌─────────────────────────────────────────┐
│           Results (${TOTAL} requests)        │
├─────────────────────────────────────────┤
│  incremented (new):   ${String(incremented).padStart(5)}              │
│  deduplicated (safe): ${String(cached).padStart(5)}              │
│  failed (exhausted):  ${String(failed).padStart(5)}              │
├─────────────────────────────────────────┤
│  requests that retried: ${String(retried).padStart(3)}              │
│  total HTTP attempts:  ${String(totalAttempts).padStart(4)}              │
│  final counter value: ${String(counter).padStart(5)}              │
└─────────────────────────────────────────┘
`);

server.stop();
