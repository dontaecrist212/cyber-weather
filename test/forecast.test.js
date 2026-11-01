// Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const F = require("../public/forecast");
const { slim } = require("../lib/kev");

const day = (offset) => new Date(Date.UTC(2026, 9, 30) - offset * 864e5).toISOString().slice(0, 10);
const vuln = (ago, extra = {}) => ({ c: "CVE-2026-" + (1000 + ago) + (extra.id || ""), v: "Acme", p: "Router", n: "x", a: day(ago), s: "", d: day(-14), r: 0, ...extra });

test("a quiet week is clear skies", () => {
  const list = [];
  for (let i = 7; i < 365; i += 2) list.push(vuln(i)); // steady background
  const out = F.compute(list, day(0), F.dayIndex(day(0)));
  assert.strictEqual(out.newLast7Days, 0);
  assert.strictEqual(out.level.key, "clear");
});

test("a busy week is severe storms", () => {
  const list = [];
  for (let i = 7; i < 365; i += 3) list.push(vuln(i));
  for (let i = 0; i < 12; i++) list.push(vuln(i % 7, { id: "b" + i }));
  const out = F.compute(list, day(0), F.dayIndex(day(0)));
  assert.strictEqual(out.newLast7Days, 12);
  assert.strictEqual(out.level.key, "warn");
});

test("two ransomware-linked additions raise the level one step", () => {
  const list = [];
  for (let i = 0; i < 365; i++) list.push(vuln(i)); // exactly 7 per week, every week
  const base = F.compute(list, day(0), F.dayIndex(day(0)));
  list[0].r = 1; list[1].r = 1;
  const bumped = F.compute(list, day(0), F.dayIndex(day(0)));
  assert.strictEqual(bumped.level.index, base.level.index + 1);
  assert.ok(bumped.raisedForRansomware);
});

test("stack matching finds vendor or product words", () => {
  const x = { v: "Google", p: "Chromium V8" };
  assert.ok(F.matchesStack(x, ["google"]));
  assert.ok(F.matchesStack(x, ["Chromium"]));
  assert.ok(!F.matchesStack(x, ["Cisco"]));
});

test("slim keeps only the last year and marks ransomware", () => {
  const feed = {
    catalogVersion: "1", dateReleased: "2026-10-30T00:00:00Z", count: 2,
    vulnerabilities: [
      { cveID: "CVE-1", vendorProject: "A", product: "B", vulnerabilityName: "n", dateAdded: "2026-10-29", shortDescription: "", dueDate: "2026-11-12", knownRansomwareCampaignUse: "Known" },
      { cveID: "CVE-2", vendorProject: "A", product: "B", vulnerabilityName: "n", dateAdded: "2020-01-01", shortDescription: "", dueDate: "2020-01-15", knownRansomwareCampaignUse: "Unknown" }
    ]
  };
  const out = slim(feed);
  assert.strictEqual(out.v.length, 1);
  assert.strictEqual(out.v[0].r, 1);
  assert.strictEqual(out.released, "2026-10-30");
});
