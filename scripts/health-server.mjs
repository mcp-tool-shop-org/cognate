import http from "node:http";
import { mkdirSync } from "node:fs";

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";

mkdirSync("/app/data", { recursive: true });

const server = http.createServer((req, res) => {
  const url = req.url?.split("?")[0] ?? "/";
  if (url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "cognate",
        mode: "placeholder",
      }),
    );
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ status: "not_found" }));
});

server.listen(port, host);
