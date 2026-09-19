export const GOOD_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme Analytics — Simple product metrics</title>
  <meta name="description" content="Acme Analytics gives small teams clear product metrics in minutes. Start free, connect your data, and see what your users actually do.">
</head>
<body>
  <h1>Know what your users actually do</h1>
  <p>Acme Analytics helps small teams understand product usage without a data team.</p>
  <img src="/dashboard.png" alt="Acme Analytics dashboard">
  <form>
    <label for="email">Work email</label>
    <input id="email" type="email" name="email">
    <button type="submit">Start free</button>
  </form>
  <a href="mailto:hello@acme.test">Contact us</a>
  <a href="/privacy">Privacy policy</a>
  <a href="/about">About</a>
</body>
</html>`;

export const LEAKY_PAGE = `<!doctype html>
<html>
<head>
  <title>This is an intentionally very long page title that easily exceeds the recommended limit for titles in most search engines</title>
</head>
<body>
  <h1>Welcome</h1>
  <h1>Our services</h1>
  <img src="/team.png">
  <img src="/decoration.png" alt="">
  <img src="/chart.png">
  <img src="/logo.png">
  <form>
    <input type="text" name="email">
  </form>
  <button>Send</button>
</body>
</html>`;
