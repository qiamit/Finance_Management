import http from "node:http";
import { writeFileSync } from "node:fs";
import handler from "serve-handler";

const raw = process.env.API_URL || process.env.VITE_API_URL || "";
const api = raw && !raw.startsWith("http") ? `https://${raw}` : raw;
writeFileSync("dist/config.js", `window.__API_URL__ = ${JSON.stringify(api)};\n`);

const port = Number(process.env.PORT || 4173);
const server = http.createServer((request, response) =>
  handler(request, response, {
    public: "dist",
    rewrites: [{ source: "**", destination: "/index.html" }],
  }),
);

server.listen(port, "0.0.0.0", () => {
  console.log(`web listening on ${port}`);
});
