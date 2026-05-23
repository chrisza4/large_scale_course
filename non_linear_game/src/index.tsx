import { serve, type ServerWebSocket } from "bun";
import index from "./index.html";

let currentValue = 0;
const clients = new Set<ServerWebSocket<unknown>>();

const port = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

const server = serve({
  port,
  hostname: "0.0.0.0",

  // In dev, Bun's bundler serves frontend.tsx and assets via the HTML import.
  // In prod, we serve pre-built files from dist/ via the fetch handler instead,
  // because the production runtime doesn't register internal asset routes for
  // HTML imports (causing MIME type errors for module scripts).
  routes: isProd ? {} : { "/*": index },

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
    const { pathname } = new URL(req.url);

    if (pathname === "/ws") {
      if (server.upgrade(req)) return undefined as any;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (isProd) {
      const path = pathname === "/" ? "/index.html" : pathname;
      const file = Bun.file(`./dist${path}`);
      return file.exists().then((exists) =>
        new Response(exists ? file : Bun.file("./dist/index.html"))
      );
    }
  },

  development: !isProd && { hmr: true, console: true },
});

console.log(`Server running at ${server.url}`);
