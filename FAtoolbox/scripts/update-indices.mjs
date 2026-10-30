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

export function validateData(data, previous = { series: [] }, now = new Date()) {
  if (!Array.isArray(data?.series) || data.series.length !== definitions.length) throw new Error("Expected five indices");
  if (!Number.isFinite(Date.parse(data.attemptedAt))) throw new Error("Invalid refresh timestamp");
  const symbols = new Set();
  for (const item of data.series) {
    const definition = definitions.find(value => value.symbol === item.symbol);
    if (!definition || symbols.has(item.symbol)) throw new Error("Unexpected or duplicate index");
    symbols.add(item.symbol);
    if (!Array.isArray(item.observations)) throw new Error("Invalid observations");
    if (!item.error && (item.observations.length < 2 || !Number.isFinite(Date.parse(item.fetchedAt)))) throw new Error("Invalid successful refresh");
    let lastDate = "";
    const today = dateInZone(now, definition.timezone);
    for (const point of item.observations) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || point.date <= lastDate || point.date >= today || !Number.isFinite(point.close) || point.close <= 0) {
        throw new Error("Invalid, unordered or intraday observation");
      }
      lastDate = point.date;
    }
    ensureNotRegressed(item.observations, previous.series?.find(value => value.symbol === item.symbol)?.observations);
  }
  return data;
}

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

// A 200 response can contain cached history. Check it against the source's
// latest market timestamp, including exchange holidays, before marking it fresh.
export function ensureSourceCurrent(result, observations, timezone, now) {
  const timestamp = result?.meta?.regularMarketTime;
  if (!Number.isFinite(timestamp)) throw new Error("Missing latest market timestamp");
  const marketDate = dateInZone(new Date(timestamp * 1000), timezone);
  const today = dateInZone(now, timezone);
  if (marketDate > today) throw new Error("Source returned a future market date");
  if (marketDate < today && observations.at(-1)?.date !== marketDate) {
    throw new Error(`Source history is incomplete: expected close for ${marketDate}`);
  }
  return marketDate;
}

export async function fetchIndex(definition, now, previous, fetchImpl = fetch) {
  let lastError;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const response = await fetchImpl(`https://${host}/v8/finance/chart/${encodeURIComponent(definition.symbol)}?range=1mo&interval=1d`, {
        headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.chart?.error) throw new Error(payload.chart.error.description);
      const result = payload.chart?.result?.[0];
      const observations = closingObservations(result, definition.timezone, now);
      const sourceMarketDate = ensureSourceCurrent(result, observations, definition.timezone, now);
      if (now - new Date(observations.at(-1).date + "T23:59:59Z") > 7 * 86400000) throw new Error("Closing history is more than a week old");
      ensureNotRegressed(observations, previous);
      return { ...definition, source: `https://finance.yahoo.com/quote/${encodeURIComponent(definition.symbol)}/history/`,
        observations,
        fetchedAt: now.toISOString(), sourceMarketDate, error: null };
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
  const data = validateData({ attemptedAt: now.toISOString(), series }, previous, now);
  await writeFile(target, JSON.stringify(data, null, 2) + "\n");
  console.log(`Updated ${series.filter(item => !item.error).length}/${series.length} indices: ${fileURLToPath(target)}`);
  if (series.some(item => item.error)) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await update();


