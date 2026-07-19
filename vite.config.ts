import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 8080,
  },
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    {
      name: "api-middleware",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const pathname = urlObj.pathname;

          if (pathname.startsWith("/api/crm") || pathname.startsWith("/api/meta/webhook")) {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", async () => {
              try {
                let handlerPath = "";
                let parsedBody = {};

                if (pathname.startsWith("/api/crm")) {
                  handlerPath = "./api/crm.ts";
                  parsedBody = body ? JSON.parse(body) : {};
                } else if (
                  pathname === "/api/meta/webhook/status" ||
                  pathname === "/api/meta/webhook/status/"
                ) {
                  handlerPath = "./api/meta/webhook/status.ts";
                } else if (pathname === "/api/meta/webhook" || pathname === "/api/meta/webhook/") {
                  handlerPath = "./api/meta/webhook.ts";
                } else {
                  next();
                  return;
                }

                const { default: handler } = await server.ssrLoadModule(handlerPath);

                const queryParams: Record<string, string> = {};
                urlObj.searchParams.forEach((val, key) => {
                  queryParams[key] = val;
                });

                const mockReq = {
                  method: req.method,
                  body: parsedBody,
                  headers: req.headers,
                  query: queryParams,
                  [Symbol.asyncIterator]: async function* () {
                    yield Buffer.from(body);
                  },
                } as any;

                let statusCode = 200;
                const headers: Record<string, string> = {};

                const mockRes = {
                  status(code: number) {
                    statusCode = code;
                    return this;
                  },
                  setHeader(name: string, value: string) {
                    headers[name] = value;
                    return this;
                  },
                  json(data: any) {
                    res.writeHead(statusCode, {
                      ...headers,
                      "Content-Type": "application/json",
                    });
                    res.end(JSON.stringify(data));
                  },
                  send(data?: any) {
                    res.writeHead(statusCode, headers);
                    res.end(data);
                  },
                  end(data?: any) {
                    res.writeHead(statusCode, headers);
                    res.end(data);
                  },
                };

                await handler(mockReq, mockRes);
              } catch (err: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
          next();
        });
      },
    },
    TanStackRouterVite({ target: "react", routesDirectory: "./src/routes" }),
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    react(),
  ],
});
