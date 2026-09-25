import http from "node:http";

import { GOOD_PAGE, LEAKY_PAGE } from "./fixtures.mjs";

const port = Number(process.env.FIXTURE_PORT ?? 3101);

/** Emails the app "sent" through EMAIL_API_URL, newest last. Tests read them back. */
const sentEmails = [];

const server = http.createServer((request, response) => {
  const url = request.url ?? "/";

  if (url === "/email" && request.method === "POST") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        sentEmails.push(JSON.parse(body));
      } catch {
        // Not JSON; nothing to record.
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: `email_${sentEmails.length}` }));
    });
    return;
  }

  request.resume();

  // GET /emails/last?to=<address>: the newest email sent to that address.
  if (url.startsWith("/emails/last")) {
    const to = new URL(url, "http://fixture").searchParams.get("to");
    const match = [...sentEmails].reverse().find((email) => !to || (email.to ?? []).includes(to));
    response.writeHead(match ? 200 : 404, { "content-type": "application/json" });
    response.end(JSON.stringify(match ?? { error: "no email" }));
    return;
  }

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
