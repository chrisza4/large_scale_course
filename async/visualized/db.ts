// SQLite schema and prepared statements for System B's job queue.
// This file is only imported by system-b.ts.

import { Database } from "bun:sqlite";
import { SQLITE_PATH } from "./config";

export const db = new Database(SQLITE_PATH);

db.run(`
  CREATE TABLE IF NOT EXISTS jobs (
    jobId TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    callbackUrl TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    nextAttemptAt TEXT NOT NULL,
    lastError TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

export type JobRow = {
  jobId: string;
  payload: string;
  callbackUrl: string;
  status: string;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export const insertJob = db.query(`
  INSERT INTO jobs (jobId, payload, callbackUrl, status, attempts, nextAttemptAt, lastError, createdAt, updatedAt)
  VALUES ($jobId, $payload, $callbackUrl, 'pending', 0, $now, NULL, $now, $now)
`);

export const claimDueJobs = db.query(`
  UPDATE jobs
  SET status = 'processing', attempts = attempts + 1, updatedAt = $now
  WHERE jobId IN (
    SELECT jobId FROM jobs
    WHERE status IN ('pending', 'retrying') AND nextAttemptAt <= $now
    ORDER BY nextAttemptAt
    LIMIT 5
  )
  RETURNING *
`);

export const markCompleted = db.query(`
  UPDATE jobs
  SET status = 'completed', updatedAt = $now
  WHERE jobId = $jobId
`);

export const markRetrying = db.query(`
  UPDATE jobs
  SET status = 'retrying', nextAttemptAt = $nextAttemptAt, lastError = $lastError, updatedAt = $now
  WHERE jobId = $jobId
`);

export const markFailed = db.query(`
  UPDATE jobs
  SET status = 'failed', lastError = $lastError, updatedAt = $now
  WHERE jobId = $jobId
`);

export const getJob = db.query(`SELECT * FROM jobs WHERE jobId = $jobId`);
