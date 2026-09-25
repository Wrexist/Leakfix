// Serves out/ the way GitHub Pages does, to check the demo before deploying:
//   npm run build:pages && npm run preview:pages
// Pass the same NEXT_PUBLIC_BASE_PATH the build used, if any.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const ROOT = resolve("out");
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
const PORT = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function fileFor(pathname) {
  const candidate = join(ROOT, pathname);
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  for (const path of [candidate, join(candidate, "index.html"), `${candidate}.html`]) {
    try {
      if (statSync(path).isFile()) return path;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (BASE && !pathname.startsWith(BASE)) {
    response.writeHead(302, { location: `${BASE}/` }).end();
    return;
  }
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(BASE.length)) || "/";
  } catch {
    response.writeHead(400).end();
    return;
  }
  // Like GitHub Pages: /pricing redirects to /pricing/ when that folder exists.
  if (!relative.endsWith("/") && !extname(relative) && fileFor(`${relative}/`)) {
    response.writeHead(301, { location: `${pathname}/` }).end();
    return;
  }
  const file = fileFor(relative);
  const status = file ? 200 : 404;
  const body = file ?? join(ROOT, "404.html");
  response.writeHead(status, { "content-type": TYPES[extname(body)] ?? "application/octet-stream" });
  createReadStream(body).pipe(response);
}).listen(PORT, () => {
  console.log(`Demo: http://localhost:${PORT}${BASE}/`);
});
