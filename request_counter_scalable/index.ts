import { Database } from "bun:sqlite";

const db = new Database("requests.db");

db.run(`
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertStmt = db.prepare("INSERT INTO requests (created_at) VALUES (datetime('now'))");
const countStmt = db.prepare<{ count: number }, []>("SELECT COUNT(*) as count FROM requests");

const server = Bun.serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/increment") {
      insertStmt.run();
      return Response.json({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/get_count") {
      const row = countStmt.get();
      return Response.json({ count: row?.count ?? 0 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
