# Async Payment Visualization Prototype

Educational prototype demonstrating resilient async communication between a
producer (System A) and a consumer (System B), with a live visualization UI.
See `spec.md` for the original requirements.

## Running

Start all three servers at once:

```bash
bun run visualize
```

Press Ctrl+C to stop all three together.

Alternatively, start each server in its own terminal, in this order:

```bash
bun visualized/hub.ts
bun visualized/system-b.ts
bun visualized/system-a.ts
```

Then open http://localhost:3002/ in your browser.

Submit a payment and watch it move through `submitted -> accepted ->
processing -> completed` (or `retrying` a few times before landing on
`completed` or `failed`, since each attempt has a 50% chance of mock
failure).
