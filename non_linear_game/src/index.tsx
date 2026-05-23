import { serve } from "bun";
import index from "./index.html";

let currentValue = 0;

const port = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

const server = serve({
  port,
  hostname: "0.0.0.0",

  routes: {
    "/api/value": {
      GET: () => Response.json({ value: currentValue }),
      POST: async (req) => {
        const body = (await req.json()) as { value: unknown };
        const num = Number(body.value);
        if (Number.isFinite(num)) currentValue = num;
        return Response.json({ value: currentValue });
      },
    },
    ...(!isProd ? { "/": index } : {}),
  },

  async fetch(req) {
    if (isProd) {
      const { pathname } = new URL(req.url);
      const path = pathname === "/" ? "/index.html" : pathname;
      const file = Bun.file(`./dist${path}`);
      const exists = await file.exists();
      return new Response(exists ? file : Bun.file("./dist/index.html"));
    }
  },

  development: !isProd && { hmr: true, console: true },
});

console.log(`Server running at ${server.url}`);
