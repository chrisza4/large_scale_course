// Plain JS UI. No framework, no build step, no destructuring tricks.

var SYSTEM_A_URL = "http://localhost:3000";
var HUB_WS_URL = "ws://localhost:3002/ws";
var MAX_ATTEMPTS = 4;

var jobs = {};

var jobsBody = document.getElementById("jobsBody");
var eventLog = document.getElementById("eventLog");
var paymentForm = document.getElementById("paymentForm");
var amountInput = document.getElementById("amountInput");

function applyEvent(event) {
  var job = jobs[event.jobId];
  if (!job) {
    job = {
      jobId: event.jobId,
      amount: null,
      status: "unknown",
      attempt: 0,
      maxAttempts: MAX_ATTEMPTS,
      lastUpdate: event.timestamp,
    };
    jobs[event.jobId] = job;
  }

  job.lastUpdate = event.timestamp;

  if (event.type === "submitted") {
    job.status = "submitted";
    if (event.payload && event.payload.amount !== undefined) {
      job.amount = event.payload.amount;
    }
  } else if (event.type === "accepted") {
    job.status = "accepted";
  } else if (event.type === "processing") {
    job.status = "processing";
    job.attempt = event.attempt;
    job.maxAttempts = event.maxAttempts;
  } else if (event.type === "retrying") {
    job.status = "retrying";
    job.attempt = event.attempt;
    job.maxAttempts = event.maxAttempts;
  } else if (event.type === "completed") {
    job.status = "completed";
  } else if (event.type === "failed") {
    job.status = "failed";
    job.error = event.error;
  } else if (event.type === "callbackReceived") {
    // System A acknowledged the outcome; keep the status from B's event as-is.
  }

  appendToLog(event);
}

function appendToLog(event) {
  var line = event.timestamp + " [" + event.source + "] " + event.type + " " + event.jobId;
  eventLog.textContent = eventLog.textContent + line + "\n";
  eventLog.scrollTop = eventLog.scrollHeight;
}

function renderJobs() {
  jobsBody.innerHTML = "";

  var jobIds = Object.keys(jobs).sort(function (a, b) {
    return jobs[b].lastUpdate.localeCompare(jobs[a].lastUpdate);
  });

  for (var i = 0; i < jobIds.length; i++) {
    var job = jobs[jobIds[i]];
    var row = document.createElement("tr");

    var shortId = job.jobId.slice(0, 8);
    var amountText = job.amount === null ? "-" : job.amount;
    var attemptText = job.attempt + " / " + job.maxAttempts;
    var updateText = new Date(job.lastUpdate).toLocaleTimeString();

    row.innerHTML =
      "<td>" + shortId + "</td>" +
      "<td>" + amountText + "</td>" +
      "<td><span class=\"badge badge-" + job.status + "\">" + job.status + "</span></td>" +
      "<td>" + attemptText + "</td>" +
      "<td>" + updateText + "</td>";

    jobsBody.appendChild(row);
  }
}

var socket = new WebSocket(HUB_WS_URL);

socket.onmessage = function (messageEvent) {
  var message = JSON.parse(messageEvent.data);

  if (message.kind === "snapshot") {
    for (var i = 0; i < message.events.length; i++) {
      applyEvent(message.events[i]);
    }
  } else if (message.kind === "event") {
    applyEvent(message.event);
  }

  renderJobs();
};

paymentForm.addEventListener("submit", function (submitEvent) {
  submitEvent.preventDefault();

  var amount = Number(amountInput.value);

  fetch(SYSTEM_A_URL + "/processPayment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amount }),
  }).catch(function (err) {
    console.log("Failed to submit payment:", err);
  });
});
