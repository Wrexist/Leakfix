export const GOOD_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-encoding": "gzip",
  "cache-control": "public, max-age=0, must-revalidate",
  etag: 'W/"abc123"',
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; frame-ancestors 'self'",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(self)",
};

export const GOOD_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme Analytics — Simple product metrics for teams</title>
  <meta name="description" content="Acme Analytics gives small teams clear product metrics in minutes. Connect your data, see what users actually do, and improve activation without a data team.">
  <link rel="canonical" href="https://acme.test/">
  <link rel="icon" href="/favicon.svg">
  <link rel="alternate" type="application/rss+xml" title="Acme blog" href="/feed.xml">
  <link rel="stylesheet" href="/styles.css">
  <meta property="og:title" content="Acme Analytics — Simple product metrics">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://acme.test/social.png">
  <meta property="og:url" content="https://acme.test/">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://acme.test/social.png">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Acme Analytics","url":"https://acme.test/"}
  </script>
</head>
<body>
  <header>
    <nav aria-label="Primary">
      <a href="/">Acme Analytics</a>
      <a href="/pricing">Pricing</a>
    </nav>
  </header>
  <main>
    <h1>Know what your users actually do</h1>
    <p>Acme Analytics helps small teams understand product usage without hiring a data team. Connect your product once and get a clear picture of activation, retention, and the moments that matter most to your customers.</p>
    <p>Most analytics tools overwhelm you with dashboards nobody opens. Acme focuses on a short list of questions that actually change decisions: who signed up, who came back, where people get stuck, and which features predict a paying customer. You get answers, not another spreadsheet to maintain.</p>
    <p>Set up takes about five minutes. Drop in a single script tag or send events from your backend, then choose the metrics your team already argues about. We handle the modelling, the storage, and the boring parts so you can spend your time improving the product instead of maintaining infrastructure.</p>
    <p>Teams use Acme to find drop-off in onboarding, spot the features that drive retention, and prove which experiments worked. Every report answers one question and points at one action, so you always know what to do next and why it matters to the business.</p>
    <p>Because onboarding is where most trials are lost, Acme highlights the exact step where people drop off and shows the change that recovered them. You can compare cohorts, watch a weekly digest, and share a single link with your team instead of exporting slides every Monday morning.</p>
    <p>Everything updates automatically, and you can keep your existing tools in place while you migrate at your own pace. Start with one question this week, add another next week, and build a habit of deciding from evidence rather than opinion across the whole company.</p>
    <img src="/dashboard.webp" alt="Acme Analytics dashboard showing weekly active users" width="1200" height="630">
    <form action="/signup" method="post">
      <label for="email">Work email</label>
      <input id="email" name="email" type="email" autocomplete="email">
      <button type="submit">Start free</button>
    </form>
    <a href="https://docs.example.com" target="_blank" rel="noopener noreferrer">Read the documentation</a>
  </main>
  <footer>
    <a href="mailto:hello@acme.test">Contact us</a>
    <a href="/privacy">Privacy policy</a>
    <a href="/about">About</a>
    <a href="https://twitter.com/acme">X</a>
    <a href="https://www.linkedin.com/company/acme">LinkedIn</a>
  </footer>
</body>
</html>`;

export const LEAKY_PAGE_HTML = `<!doctype html>
<html>
<head>
  <title>This is an intentionally very long page title that easily exceeds the recommended limit for titles in most search engines</title>
</head>
<body>
  <h1>Welcome</h1>
  <h3>Our services</h3>
  <h1>Second big heading</h1>
  <form action="http://insecure.example.com/collect" method="post">
    <input type="text" name="email">
  </form>
  <img src="/team.png">
  <img src="/decoration.png" alt="">
  <img src="/chart.png">
  <img src="/logo.jpg">
  <a href="http://cdn.example.com/script.js">http asset</a>
  <a href="#" target="_blank">Click here</a>
  <button></button>
  <iframe src="/widget"></iframe>
</body>
</html>`;

export const MINIMAL_PAGE_HTML = `<!doctype html>
<html>
<head></head>
<body></body>
</html>`;
