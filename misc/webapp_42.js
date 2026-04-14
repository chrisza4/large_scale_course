const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("state.db");

db.exec(
  "CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value INTEGER)",
);

app.get("/state", (req, res) => {
  const { value } = db
    .prepare("SELECT value FROM state WHERE key = ?")
    .get("value");
  res.json({ value });
});

app.get("/set42", (req, res) => {
  // ** This can be called in another server **
  const val = parseInt(req.query.v ?? 42);
  db.prepare("UPDATE state SET value = ? WHERE key = ?").run(val, "value");
  res.json({ value: val });
});

app.listen(3000, () => console.log("Server on port 3000"));
