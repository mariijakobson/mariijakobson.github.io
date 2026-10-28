import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const target = new URL("../data/indices.json", import.meta.url);
const definitions = [
  { name: "Nasdaq-100", symbol: "^NDX", timezone: "America/New_York", color: "#386494" },
  { name: "OMXS30", symbol: "^OMX", timezone: "Europe/Stockholm", color: "#ae7c27" },
  { name: "Nikkei 225", symbol: "^N225", timezone: "Asia/Tokyo", color: "#b65d64" },
  { name: "EURO STOXX 50", symbol: "^STOXX50E", timezone: "Europe/Zurich", color: "#8171b1" },
  { name: "S&P 500", symbol: "^GSPC", timezone: "America/New_York", color: "#278679" }
];

export function dateInZone(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

export function closingObservations(result, timezone, now = new Date()) {
  const today = dateInZone(now, timezone);
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) throw new Error("Missing daily history");
  const points = new Map();
  timestamps.forEach((timestamp, index) => {
    const close = closes[index];
    if (!Number.isFinite(timestamp)) return;
    const date = dateInZone(new Date(timestamp * 1000), timezone);
    // Exclude the current exchange-local date, even if that market has closed.
    if (date < today && Number.isFinite(close) && close > 0) points.set(date, close);
  });
  const observations = [...points].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close })).slice(-8);
  if (observations.length < 2) throw new Error("Insufficient closing history");
  return observations;
}

export function ensureNotRegressed(observations, previous = []) {
  const latest = observations.at(-1)?.date;
  const previousLatest = previous.at(-1)?.date;
  if (previousLatest && (!latest || latest < previousLatest)) {
    throw new Error("Source returned older closing history than already published");
  }
  return observations;
}

async function fetchIndex(definition, now, previous) {
  let lastError;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const response = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(definition.symbol)}?range=1mo&interval=1d`, {
        headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.chart?.error) throw new Error(payload.chart.error.description);
      const observations = closingObservations(payload.chart?.result?.[0], definition.timezone, now);
      if (now - new Date(observations.at(-1).date + "T23:59:59Z") > 7 * 86400000) throw new Error("Closing history is more than a week old");
      ensureNotRegressed(observations, previous);
      return { ...definition, source: `https://finance.yahoo.com/quote/${encodeURIComponent(definition.symbol)}/history/`,
        observations,
        fetchedAt: now.toISOString(), error: null };
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function update() {
  const now = new Date();
  let previous = { series: [] };
  try { previous = JSON.parse(await readFile(target, "utf8")); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const series = [];
  for (const definition of definitions) {
    const old = previous.series.find(item => item.symbol === definition.symbol);
    try { series.push(await fetchIndex(definition, now, old?.observations)); }
    catch (error) {
      series.push({ ...definition, ...old, observations: old?.observations || [], error: "Daily update failed" });
      console.error(`${definition.name}: ${error.message}`);
    }
  }
  await writeFile(target, JSON.stringify({ attemptedAt: now.toISOString(), series }, null, 2) + "\n");
  console.log(`Updated ${series.filter(item => !item.error).length}/${series.length} indices: ${fileURLToPath(target)}`);
  if (series.some(item => item.error)) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await update();

