// System A: producer. Exposes an endpoint the browser calls to start a
// payment. Hands the job to System B and returns immediately without
// waiting for the job to finish. Receives a callback from System B once
// the job completes or permanently fails.

import { sendEvent } from "./sendEvent";
import { PORT_A, SYSTEM_A_URL, SYSTEM_B_URL } from "./config";
import { withCors, corsPreflight } from "./cors";

type ProcessPaymentRequest = {
  amount: number;
};

type CallbackBody = {
  status: string;
  error?: string;
};

Bun.serve({
  port: PORT_A,
  routes: {
    "/processPayment": {
      OPTIONS: () => corsPreflight(),
      POST: async (req) => {
        const body = (await req.json()) as ProcessPaymentRequest;
        const jobId = crypto.randomUUID();
        const payload = body;
        const now = new Date().toISOString();

        console.log(
          "[System A] received processPayment request, jobId " + jobId,
        );

        sendEvent({
          type: "submitted",
          jobId: jobId,
          timestamp: now,
          source: "A",
          payload: payload,
        });

        const response = await fetch(SYSTEM_B_URL + "/startProcessing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: jobId,
            payload: payload,
            callbackUrl: SYSTEM_A_URL + "/callback/" + jobId,
          }),
        });

        const bResult = await response.json();
        console.log("[System A] System B responded:", bResult);

        return withCors(
          Response.json(
            { jobId: jobId, status: "accepted" },
            { status: 202 },
          ),
        );
      },
    },
    "/callback/:jobId": {
      OPTIONS: () => corsPreflight(),
      POST: async (req) => {
        const body = (await req.json()) as CallbackBody;
        const jobId = req.params.jobId;

        console.log(
          "[System A] received callback for job " + jobId + ":",
          body,
        );

        sendEvent({
          type: "callbackReceived",
          jobId: jobId,
          timestamp: new Date().toISOString(),
          source: "A",
          status: body.status,
          error: body.error,
        });

        return withCors(new Response("OK"));
      },
    },
  },
});

console.log("[System A] listening on http://localhost:" + PORT_A);
