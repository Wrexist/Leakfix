import http from "node:http";

import { GOOD_PAGE, LEAKY_PAGE } from "./fixtures.mjs";

const port = Number(process.env.FIXTURE_PORT ?? 3101);

const server = http.createServer((request, response) => {
  request.resume();
  const url = request.url ?? "/";

  if (url.startsWith("/slow")) {
    setTimeout(() => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(LEAKY_PAGE);
    }, 2500);
    return;
  }

  if (url.startsWith("/leaky")) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(LEAKY_PAGE);
    return;
  }

  if (url === "/redirect") {
    response.writeHead(302, { location: "/good" });
    response.end();
    return;
  }

  if (url === "/json") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"ok":true}');
    return;
  }

  if (url === "/missing") {
    response.writeHead(404, { "content-type": "text/html" });
    response.end("<h1>Not found</h1>");
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(GOOD_PAGE);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fixture server listening on http://127.0.0.1:${port}`);
});
