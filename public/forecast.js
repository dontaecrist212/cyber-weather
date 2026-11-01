/*
 * Cyber Weather forecast math.
 * This one file is used by both the server (require) and the browser (<script>),
 * so the page and the API always agree on the forecast.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CyberForecast = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DAY = 864e5;

  /** "2026-10-30" -> whole days since 1970-01-01 (UTC) */
  function dayIndex(s) {
    return Math.floor(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY);
  }
  function todayIndex(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
  }

  const LEVELS = [
    { key: "clear", name: "Clear skies", alert: "No alert", color: "--clear",
      advice: "A quiet week. Use it to catch up on routine patching and check that your backups restore." },
    { key: "cloudy", name: "Partly cloudy", alert: "Cyber advisory", color: "--cloudy",
      advice: "Normal activity. Review the alerts below and patch anything in your stack within your usual cycle." },
    { key: "watch", name: "Storm watch", alert: "Cyber watch", color: "--watch",
      advice: "Above-average activity. Check the alerts below against your stack today and move matching patches to the front of the line." },
    { key: "warn", name: "Severe storms", alert: "Cyber warning", color: "--warn",
      advice: "Heavy exploitation this week. Patch internet-facing systems that match these alerts now, and watch their logs for signs of compromise." }
  ];

  /** Does a vulnerability match any vendor/product term in the user's stack? */
  function matchesStack(v, stack) {
    const hay = (v.v + " " + v.p).toLowerCase();
    return (stack || []).some((t) => {
      const q = String(t).toLowerCase().trim();
      if (!q) return false;
      return hay.includes(q) || q.split(/\s+/).every((w) => hay.includes(w));
    });
  }

  function countBy(list, key) {
    const m = {};
    list.forEach((x) => (m[x[key]] = (m[x[key]] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  /**
   * vulns: [{c,v,p,n,a,s,d,r}]  (cve, vendor, product, name, dateAdded, description, dueDate, ransomware 0/1)
   * released: "YYYY-MM-DD" date of the catalog = the observation day
   */
  function compute(vulns, released, today = todayIndex()) {
    const obs = dayIndex(released);
    const V = vulns
      .map((x) => ({ ...x, ago: obs - dayIndex(x.a), dueIn: dayIndex(x.d) - today }))
      .filter((x) => x.ago >= 0)
      .sort((a, b) => a.ago - b.ago || a.c.localeCompare(b.c));

    const perDay = new Map();
    V.forEach((x) => perDay.set(x.ago, (perDay.get(x.ago) || 0) + 1));
    const windowCount = (from, len) => {
      let s = 0;
      for (let i = from; i < from + len; i++) s += perDay.get(i) || 0;
      return s;
    };

    const last7 = V.filter((x) => x.ago < 7);
    const c7 = last7.length;
    const r7 = last7.filter((x) => x.r).length;

    // Where does this week rank against every 7-day stretch of the past year?
    const rolling = [];
    for (let i = 0; i < 365; i++) rolling.push(windowCount(i, 7));
    const below = rolling.filter((n) => n < c7).length;
    const ties = rolling.filter((n) => n === c7).length;
    const percentile = (below + ties / 2) / rolling.length;

    let level = percentile < 0.35 ? 0 : percentile < 0.6 ? 1 : percentile < 0.85 ? 2 : 3;
    const raisedForRansomware = r7 >= 2 && level < 3;
    if (raisedForRansomware) level++;

    const yearCount = V.filter((x) => x.ago < 365).length;
    const last14 = [];
    for (let i = 13; i >= 0; i--) last14.push({ ago: i, date: new Date((obs - i) * DAY).toISOString().slice(0, 10), count: perDay.get(i) || 0 });

    return {
      observed: released,
      level: { index: level, ...LEVELS[level] },
      raisedForRansomware,
      newLast7Days: c7,
      ransomwareLast7Days: r7,
      percentileVsPastYear: Math.round(percentile * 100),
      deadlinesNext14Days: V.filter((x) => x.dueIn >= 0 && x.dueIn <= 14).length,
      addedPastYear: yearCount,
      dailyAverage: +(yearCount / 365).toFixed(2),
      topVendorsLast7Days: countBy(last7, "v").slice(0, 3).map(([vendor, count]) => ({ vendor, count })),
      stormFronts90Days: countBy(V.filter((x) => x.ago < 90), "v").slice(0, 8).map(([vendor, count]) => ({ vendor, count })),
      last14Days: last14,
      vulns: V
    };
  }

  /** A personal forecast for a list of vendors/products. */
  function localForecast(F, stack) {
    const m30 = F.vulns.filter((x) => x.ago < 30 && matchesStack(x, stack));
    const m7 = m30.filter((x) => x.ago < 7);
    const nextDue = F.vulns.filter((x) => matchesStack(x, stack) && x.dueIn >= 0).sort((a, b) => a.dueIn - b.dueIn)[0] || null;
    const name = m7.length >= 3 ? "Severe storms" : m7.length >= 1 ? "Storm watch" : m30.length ? "Partly cloudy" : "Clear skies";
    return { name, matchesLast7Days: m7.length, matchesLast30Days: m30.length, nextDeadline: nextDue };
  }

  return { DAY, LEVELS, dayIndex, todayIndex, matchesStack, compute, localForecast };
});
