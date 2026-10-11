// Memoization: remember the result of a function call for a given input,
// so calling it again with the same input skips the work and returns
// the saved answer instead.

const cache = new Map();

// Emulated data store: a hashmap standing in for a slow DB/API call.
const userStore = new Map([
  [1, { id: 1, name: "Alice" }],
  [2, { id: 2, name: "Bob" }],
  [3, { id: 3, name: "Carol" }],
]);

async function memoizedFetchUser(id: number) {
  if (cache.has(id)) {
    console.log(`cache hit for ${id}`);
    return cache.get(id);
  }

  console.log(`cache miss for ${id}, fetching...`);
  const result = await fetchUser(id);
  cache.set(id, result);
  return result;
}

// Simulate a slow lookup (e.g. DB/network) so the cache speedup is visible.
async function fetchUser(id: number) {
  await Bun.sleep(50);
  return userStore.get(id);
}

console.log("First call (not cached yet):");
console.time("first call");
console.log(await memoizedFetchUser(1));
console.timeEnd("first call");

console.log("\nSecond call (same input, served from cache):");
console.time("second call");
console.log(await memoizedFetchUser(1));
console.timeEnd("second call");
