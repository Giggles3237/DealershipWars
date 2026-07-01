import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { baseCards } from "../shared/cards.js";
import { GameStore } from "./game-store.js";
import { RoomManager } from "./room-manager.js";
import { registerSocketHandlers } from "./socket-handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const clientDir = path.join(rootDir, "client");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

const store = new GameStore();
const roomManager = new RoomManager(store);

const serveFile = (response, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(response);
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (url.pathname === "/api/cards") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(baseCards));
    return;
  }

  const requestedPath = url.pathname === "/" ? "/client/index.html" : url.pathname === "/studio" ? "/client/studio.html" : url.pathname;
  const normalized = path.normalize(path.join(rootDir, requestedPath));
  if (!normalized.startsWith(rootDir) || !fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  serveFile(response, normalized);
});

const wsServer = new WebSocketServer({ server, path: "/ws" });
registerSocketHandlers({ wsServer, roomManager });

server.listen(port, host, () => {
  console.log(`Dealership Wars multiplayer server running at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
});
