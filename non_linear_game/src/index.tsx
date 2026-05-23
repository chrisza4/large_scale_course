import { serve, type ServerWebSocket } from "bun";
import index from "./index.html";

let currentValue = 0;
const clients = new Set<ServerWebSocket<unknown>>();

const server = serve({
  routes: {
    "/*": index,
  },

  websocket: {
    open(ws) {
      clients.add(ws);
      ws.send(String(currentValue));
    },
    message(_ws, msg) {
      const num = Number(msg);
      if (!Number.isFinite(num)) return;
      currentValue = num;
      for (const client of clients) {
        client.send(String(currentValue));
      }
    },
    close(ws) {
      clients.delete(ws);
    },
  },

  fetch(req, server) {
    if (new URL(req.url).pathname === "/ws") {
      if (server.upgrade(req)) return undefined as any;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
