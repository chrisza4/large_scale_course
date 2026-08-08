// Tiny fire-and-forget helper used by both System A and System B to notify
// the Hub of state changes. A hub outage must never crash A or B, so any
// error here is just logged and swallowed.

import { HUB_EVENT_URL } from "./config";

export type HubEvent = {
  type:
    | "submitted"
    | "accepted"
    | "processing"
    | "retrying"
    | "completed"
    | "failed"
    | "callbackReceived";
  jobId: string;
  timestamp: string;
  source: "A" | "B";
  attempt?: number;
  maxAttempts?: number;
  nextAttemptAt?: string;
  status?: string;
  error?: string;
  payload?: unknown;
};

export function sendEvent(event: HubEvent) {
  fetch(HUB_EVENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch((err) => {
    console.log("[sendEvent] failed to reach hub:", (err as Error).message);
  });
}
