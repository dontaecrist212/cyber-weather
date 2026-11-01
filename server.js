// Cyber Weather server. No extra packages needed: run it with `node server.js`.
const http = require("http");
const fs = require("fs");
const path = require("path");
const kev = require("./lib/kev");
const Forecast = require("./public/forecast");

const PORT = process.env.PORT || 3000;
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS || 6);
const REFRESH_MS = REFRESH_HOURS * 3600 * 1000;
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".webmanifest": "application/manifest+json" };

// Start with the bundled snapshot so the site works instantly, then fetch live data.
kev.loadSnapshot();
let refreshing = null;
function refreshInBackground() {
  if (!refreshing) refreshing = kev.refresh().finally(() => (refreshing = null));
  return refreshing;
}
refreshInBackground();
setInterval(refreshInBackground, REFRESH_MS).unref();

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300"
  });
  res.end(JSON.stringify(body));
}

function publicVuln(x) {
  return {
    cve: x.c, vendor: x.v, product: x.p, name: x.n, description: x.s,
    dateAdded: x.a, patchBy: x.d, ransomware: !!x.r,
    link: `https://nvd.nist.gov/vuln/detail/${x.c}`
  };
}

function forecastBody(url) {
  const data = kev.get();
  const F = Forecast.compute(data.v, data.released);
  const { vulns, ...summary } = F;
  const body = {
    ...summary,
    catalog: { version: data.version, total: data.total, fetchedAt: data.fetchedAt, source: data.source },
    newAlerts: vulns.filter((x) => x.ago < 7).map(publicVuln)
  };
  const stack = (url.searchParams.get("stack") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (stack.length) {
    const local = Forecast.localForecast(F, stack);
    body.yourStack = { terms: stack, ...local, nextDeadline: local.nextDeadline && publicVuln(local.nextDeadline) };
  }
  return body;
}

function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === "/" ? "index.html" : pathname));
  if (!file.startsWith(PUBLIC)) return sendJson(res, 403, { error: "Forbidden" });
  fs.readFile(file, (err, buf) => {
    if (err) return sendJson(res, 404, { error: "Not found" });
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "Use GET" });

  // Free hosts put idle apps to sleep, so also refresh when someone visits and the data is old.
  if (kev.isStale(REFRESH_MS)) refreshInBackground();

  try {
    switch (url.pathname) {
      case "/api/kev":
        return sendJson(res, 200, kev.get());
      case "/api/forecast":
        return sendJson(res, 200, forecastBody(url));
      case "/health": {
        const d = kev.get();
        return sendJson(res, 200, { ok: true, catalog: d.version, source: d.source, fetchedAt: d.fetchedAt });
      }
      default:
        return serveStatic(req, res, url.pathname);
    }
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: "Something went wrong on the server" });
  }
});

server.listen(PORT, () => console.log(`Cyber Weather is running at http://localhost:${PORT}`));
