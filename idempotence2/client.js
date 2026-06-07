const SERVER = "http://localhost:5105";
const TOTAL = 1000;
const TIMEOUT_MS = 500;

async function increment(key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVER}/increment`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function incrementWithRetry(key) {
  let attempts = 0;
  while (true) {
    attempts++;
    try {
      const result = await increment(key);
      return { ...result, attempts };
    } catch (err) {
      console.log(
        `  [retry ${attempts}] key=${key.slice(0, 8)}... reason=${err.message}`,
      );
    }
  }
}

let lastResult = 0;

const BATCH_SIZE = 100;

async function main() {
  console.log(`Sending ${TOTAL} increment requests to ${SERVER}...\n`);
  let totalRetries = 0;
  let cachedCount = 0;

  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const count = Math.min(BATCH_SIZE, TOTAL - i);
    const keys = Array.from({ length: count }, () => crypto.randomUUID());
    const results = await Promise.all(keys.map(incrementWithRetry));

    for (const result of results) {
      totalRetries += result.attempts - 1;
      if (result.cached) cachedCount++;
      lastResult = Math.max(lastResult, result.value);
    }

    console.log(
      `Progress: ${i + count}/${TOTAL}  counter=${lastResult}  retries_so_far=${totalRetries}`,
    );
  }

  console.log(`\nDone.`);
  console.log(`  Total operations : ${TOTAL}`);
  console.log(`  Total retries    : ${totalRetries}`);
  console.log(`  Cached responses : ${cachedCount}`);
  console.log(`  Final: `);
}

main();
