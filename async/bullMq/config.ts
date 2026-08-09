// BullMQ-specific config. Reuses System A/B's shared tuning constants and
// URLs so this worker is a drop-in swap for visualized/system-b.ts.

export {
  PORT_A,
  PORT_B,
  SYSTEM_A_URL,
  SYSTEM_B_URL,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  MOCK_WORK_MS,
  FAILURE_PROBABILITY,
} from "../visualized/config";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6380";
export const QUEUE_NAME = "payments";
export const PORT_BULLBOARD = 3010;
