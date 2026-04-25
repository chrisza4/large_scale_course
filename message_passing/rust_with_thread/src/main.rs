use std::cell::UnsafeCell;
use std::sync::Arc;
use std::thread;

// --- Version 1: Shared Mutable State (mirrors index.ts) ---
// Without synchronization, concurrent reads + writes produce a race condition.

struct RawState(UnsafeCell<i64>);

// SAFETY: We are deliberately opting out of Rust's thread-safety guarantee here
// to demonstrate what happens with unsynchronised shared state.
unsafe impl Sync for RawState {}

impl RawState {
    fn new() -> Self {
        RawState(UnsafeCell::new(0))
    }

    fn increment_by(&self, n: i64) {
        unsafe {
            let ptr = self.0.get();
            let current = *ptr;
            // yield gives the scheduler a chance to interleave other threads
            // between the read and the write — widening the race window.
            *ptr = current + n;
        }
    }

    fn read_state(&self) -> i64 {
        unsafe { *self.0.get() }
    }
}

fn version1_shared_state(iteration: i64) {
    println!("=== Version 1: Shared Mutable State (like index.ts) ===");
    println!("{iteration} threads each increment state by 1 — expected {iteration}\n");

    let state = Arc::new(RawState::new());
    let mut handles = vec![];

    for _ in 0..iteration {
        let state = Arc::clone(&state);
        let handle = thread::spawn(move || {
            state.increment_by(1);
        });
        handles.push(handle);
    }

    for h in handles {
        h.join().unwrap();
    }

    let result = state.read_state();
    println!("Final state : {result}");
    println!("Lost updates: {}", iteration - result);
    println!("(non-deterministic — run again to see different results)\n");
}

// --- Version 2: Message Passing (mirrors index2.ts) ---
// Each thread sends a message; a single consumer folds them into final state.
// The channel itself is the synchronisation primitive — no shared mutation.

enum Operation {
    IncrementBy(i64),
    DecrementBy(i64),
}

struct MessageState {
    ops: Vec<Operation>,
}

impl MessageState {
    fn new() -> Self {
        MessageState { ops: Vec::new() }
    }

    fn increment_by(&mut self, n: i64) {
        self.ops.push(Operation::IncrementBy(n));
    }

    fn decrement_by(&mut self, n: i64) {
        self.ops.push(Operation::DecrementBy(n));
    }
}

fn read_state(ops: Vec<Operation>) -> i64 {
    ops.into_iter().fold(0, |acc, msg| match msg {
        Operation::IncrementBy(n) => acc + n,
        Operation::DecrementBy(n) => acc - n,
    })
}

fn version2_message_passing(iteration: i64) {
    println!("=== Version 2: Message Passing (like index2.ts) ===");
    println!("{iteration} threads each send increment_by(1) — expected {iteration}\n");

    let handles: Vec<_> = (0..iteration)
        .map(|_| {
            thread::spawn(|| {
                let mut state = MessageState::new();
                state.increment_by(3);
                state.decrement_by(2);
                state.ops
            })
        })
        .collect();

    let all_ops: Vec<Operation> = handles
        .into_iter()
        .flat_map(|h| h.join().unwrap())
        .collect();

    let result = read_state(all_ops);
    println!("Final state : {result}");
    println!("Lost updates: {}", iteration - result);
    println!("(always 0 — every op lives in the returned Vec, nothing is dropped)\n");
}

fn main() {
    let iteration = 20000;
    version1_shared_state(iteration);
    version2_message_passing(iteration);
}
