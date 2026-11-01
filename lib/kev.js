// Downloads CISA's Known Exploited Vulnerabilities (KEV) catalog and keeps a slim copy in memory.
const fs = require("fs");
const path = require("path");

const SOURCES = [
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
  // Official CISA mirror on GitHub, used if the main site is slow or down
  "https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json"
];
const SNAPSHOT = path.join(__dirname, "..", "data", "kev-snapshot.json");
const KEEP_DAYS = 372; // a year of history plus a week, enough for the forecast

let current = null; // { version, released, total, v: [...], fetchedAt, source }

/** Turn the full CISA feed into the small shape the app uses. */
function slim(feed) {
  const released = String(feed.dateReleased).slice(0, 10);
  const cutoff = Date.parse(released) - KEEP_DAYS * 864e5;
  const v = feed.vulnerabilities
    .filter((x) => Date.parse(x.dateAdded) >= cutoff)
    .map((x) => ({
      c: x.cveID, v: x.vendorProject, p: x.product, n: x.vulnerabilityName,
      a: x.dateAdded, s: x.shortDescription, d: x.dueDate,
      r: x.knownRansomwareCampaignUse === "Known" ? 1 : 0
    }));
  return { version: feed.catalogVersion, released, total: feed.count, v };
}

function loadSnapshot() {
  const data = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
  current = { ...data, fetchedAt: null, source: "bundled snapshot" };
  return current;
}

async function refresh() {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "cyber-weather/1.0" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const feed = await res.json();
      if (!Array.isArray(feed.vulnerabilities)) throw new Error("unexpected format");
      current = { ...slim(feed), fetchedAt: new Date().toISOString(), source: url };
      console.log(`[kev] loaded catalog ${current.version} (${current.total} total) from ${url}`);
      return current;
    } catch (err) {
      console.warn(`[kev] could not fetch ${url}: ${err.message}`);
    }
  }
  console.warn("[kev] all sources failed; keeping the data we already have");
  return current;
}

function get() {
  return current || loadSnapshot();
}

/** True if the data is older than maxAgeMs (or was never fetched live). */
function isStale(maxAgeMs) {
  return !current || !current.fetchedAt || Date.now() - Date.parse(current.fetchedAt) > maxAgeMs;
}

module.exports = { get, refresh, loadSnapshot, isStale, slim };
