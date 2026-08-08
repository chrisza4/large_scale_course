// Shared constants for all three servers in this prototype.

export const PORT_A = 3000;
export const PORT_B = 3001;
export const PORT_HUB = 3002;

// Retry / worker tuning
export const MAX_ATTEMPTS = 4; // 1 initial try + up to 3 retries
export const RETRY_DELAY_MS = 3000; // fixed delay between retries
export const POLL_INTERVAL_MS = 1000; // how often System B's worker checks for due jobs
export const MOCK_WORK_MS = 800; // simulated processing time per attempt
export const FAILURE_PROBABILITY = 0.5; // chance a single attempt fails

export const SQLITE_PATH = "visualized/jobs.sqlite";

export const HUB_EVENT_URL = "http://localhost:" + PORT_HUB + "/events";
export const SYSTEM_A_URL = "http://localhost:" + PORT_A;
export const SYSTEM_B_URL = "http://localhost:" + PORT_B;
