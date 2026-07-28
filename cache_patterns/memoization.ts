// Memoization: remember the result of a function call for a given input,
// so calling it again with the same input skips the work and returns
// the saved answer instead.

const cache = new Map();

function memoizedFibonacci(n: number): number {
  if (cache.has(n)) {
    console.log(`cache hit for ${n}`);
    return cache.get(n);
  }

  console.log(`cache miss for ${n}, computing...`);
  const result = fibonacci(n);
  cache.set(n, result);
  return result;
}

// Naive recursive Fibonacci is deliberately slow (exponential time)
// so the speedup from caching is easy to see.
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("First call (not cached yet):");
console.time("first call");
console.log(memoizedFibonacci(30));
console.timeEnd("first call");

console.log("\nSecond call (same input, served from cache):");
console.time("second call");
console.log(memoizedFibonacci(30));
console.timeEnd("second call");

// Is memoized function read-aside or read-through?
// Well... if I am in memoizedFibonacci, it is read aside
// From perspective of conosle.log() in main, it is read through
// That is why I think read-aside vs. read-through does not make much sense
// The real design choice is - which layer would you cache this?
