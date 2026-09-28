import type { ServerResponse } from "http";

export function handleHealth(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", service: "cognate", mode: "api" }));
}
