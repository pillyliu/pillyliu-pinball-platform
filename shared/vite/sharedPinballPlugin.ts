import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePinballRulesheetProxyRequest } from "./pinballRulesheetProxy";

type NextFn = (err?: unknown) => void;
type Middleware = (req: IncomingMessage, res: ServerResponse, next: NextFn) => void;
type MiddlewareServer = { use: (fn: Middleware) => void };

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".csv": "text/csv",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function toSafeFsPath(sharedPinballDir: string, urlPath: string): string | null {
  const rel = decodeURIComponent(urlPath.replace(/^\/pinball\/?/, ""));
  const candidate = path.resolve(sharedPinballDir, rel);
  const base = path.resolve(sharedPinballDir);
  if (!candidate.startsWith(base)) return null;
  return candidate;
}

function makePinballMiddleware(sharedPinballDir: string): Middleware {
  return (req: IncomingMessage, res: ServerResponse, next: NextFn) => {
    handlePinballRulesheetProxyRequest(req, res)
      .then((handled) => {
        if (handled) return;
        const rawUrl = req.url ?? "/";
        const pathname = rawUrl.split("?")[0] ?? "/";
        if (pathname !== "/pinball" && !pathname.startsWith("/pinball/")) {
          next();
          return;
        }

        const fsPath = toSafeFsPath(sharedPinballDir, pathname);
        if (!fsPath) {
          res.statusCode = 400;
          res.end("Invalid path");
          return;
        }

        fs.stat(fsPath, (err, stat) => {
          if (err || !stat.isFile()) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", contentTypeFor(fsPath));
          res.setHeader("Cache-Control", "no-cache");

          const stream = fs.createReadStream(fsPath);
          stream.on("error", () => {
            res.statusCode = 500;
            res.end("Read error");
          });
          stream.pipe(res);
        });
      })
      .catch((error) => next(error));
  };
}

export function sharedPinballPlugin(monorepoRoot: string) {
  const sharedPinballDir = path.resolve(monorepoRoot, "shared", "pinball");
  const middleware = makePinballMiddleware(sharedPinballDir);

  return {
    name: "shared-pinball-static",
    configureServer(server: { middlewares: MiddlewareServer }) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: { middlewares: MiddlewareServer }) {
      server.middlewares.use(middleware);
    },
  };
}
