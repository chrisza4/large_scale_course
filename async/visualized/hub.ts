// Hub: serves the visualization UI and relays job events to the browser
// over WebSocket. This is the ONLY file in the prototype that knows about
// WebSockets — System A and System B just POST plain events here.

import { PORT_HUB } from "./config";
import type { HubEvent } from "./sendEvent";

const MAX_RECENT_EVENTS = 200;
const recentEvents: HubEvent[] = [];

const sockets = new Set<WebSocket>();

const indexHtml = await Bun.file(import.meta.dir + "/public/index.html").text();
const appJs = await Bun.file(import.meta.dir + "/public/app.js").text();
const stylesCss = await Bun.file(import.meta.dir + "/public/styles.css").text();

Bun.serve({
  port: PORT_HUB,
  routes: {
    "/": () => new Response(indexHtml, { headers: { "Content-Type": "text/html" } }),
    "/app.js": () => new Response(appJs, { headers: { "Content-Type": "application/javascript" } }),
    "/styles.css": () => new Response(stylesCss, { headers: { "Content-Type": "text/css" } }),
    "/events": {
      POST: async (req) => {
        const event = (await req.json()) as HubEvent;

        recentEvents.push(event);
        if (recentEvents.length > MAX_RECENT_EVENTS) {
          recentEvents.shift();
        }

        const message = JSON.stringify({ kind: "event", event: event });
        for (const socket of sockets) {
          socket.send(message);
        }

        return new Response("OK");
      },
    },
    "/ws": (req, server) => {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    },
  },
  websocket: {
    open(ws) {
      sockets.add(ws);
      ws.send(JSON.stringify({ kind: "snapshot", events: recentEvents }));
    },
    message() {
      // one-way: server -> browser only, nothing to do with client messages
    },
    close(ws) {
      sockets.delete(ws);
    },
  },
});

console.log("[Hub] listening on http://localhost:" + PORT_HUB);
