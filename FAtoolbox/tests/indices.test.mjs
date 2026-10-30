import assert from "node:assert/strict";
import { closingObservations, dateInZone, ensureNotRegressed, ensureSourceCurrent, fetchIndex, validateData } from "../scripts/update-indices.mjs";

const timestamp = date => Date.parse(date) / 1000;
const result = {
  timestamp: ["2026-10-22T13:30:00Z", "2026-10-23T13:30:00Z", "2026-10-26T13:30:00Z"].map(timestamp),
  indicators: { quote: [{ close: [100, 102, 105] }] }
};
assert.deepEqual(closingObservations(result, "America/New_York", new Date("2026-10-26T22:00:00Z")), [
  { date: "2026-10-22", close: 100 }, { date: "2026-10-23", close: 102 }
]);
// Monday still shows Friday, including after Monday's close.
assert.equal(closingObservations(result, "America/New_York", new Date("2026-10-25T12:00:00Z")).at(-1).date, "2026-10-23");
// Exchange-local midnight, not UTC midnight, determines the exclusion boundary.
assert.equal(dateInZone(new Date("2026-10-26T00:30:00Z"), "America/New_York"), "2026-10-25");
assert.equal(dateInZone(new Date("2026-10-25T16:00:00Z"), "Asia/Tokyo"), "2026-10-26");
assert.throws(() => closingObservations({ timestamp: [1], indicators: { quote: [{ close: [null] }] } }, "UTC"), /Insufficient/);
assert.throws(() => closingObservations({}, "UTC"), /Missing/);


// Do not replace published data with an older successful HTTP response.
const old = [{ date: "2026-10-27", close: 100 }];
assert.throws(() => ensureNotRegressed([{ date: "2026-10-26", close: 99 }], old), /older/);
assert.doesNotThrow(() => ensureNotRegressed(old, old));
assert.doesNotThrow(() => ensureNotRegressed([{ date: "2026-10-28", close: 101 }], old));
assert.doesNotThrow(() => ensureNotRegressed(old));
// Malformed timestamps must not discard otherwise valid history.
const malformed = structuredClone(result);
malformed.timestamp.push(null, "bad");
malformed.indicators.quote[0].close.push(999, 999);
assert.deepEqual(closingObservations(malformed, "America/New_York", new Date("2026-10-27T12:00:00Z")),
  closingObservations(result, "America/New_York", new Date("2026-10-27T12:00:00Z")));

const now = new Date("2026-10-27T08:00:00Z");
const latestResult = { ...result, meta: { regularMarketTime: timestamp("2026-10-26T20:00:00Z") } };
const observations = closingObservations(latestResult, "America/New_York", now);
assert.equal(ensureSourceCurrent(latestResult, observations, "America/New_York", now), "2026-10-26");
assert.throws(() => ensureSourceCurrent(latestResult, observations.slice(0, -1), "America/New_York", now), /incomplete/);
assert.throws(() => ensureSourceCurrent(result, observations, "America/New_York", now), /Missing latest/);
// A market holiday can legitimately retain the preceding trading day's close.
const holidayResult = { ...latestResult, meta: { regularMarketTime: timestamp("2026-10-23T20:00:00Z") } };
assert.equal(ensureSourceCurrent(holidayResult, observations.slice(0, -1), "America/New_York", now), "2026-10-23");
// Today's market timestamp must not allow an intraday value into yesterday's closes.
assert.equal(ensureSourceCurrent(latestResult, observations.slice(0, -1), "America/New_York", new Date("2026-10-26T22:00:00Z")), "2026-10-26");
assert.throws(() => ensureSourceCurrent(latestResult, observations, "America/New_York", new Date("2026-10-25T12:00:00Z")), /future/);

// Failure or incomplete history from the first host must try the second host.
const definition = { name: "Test", symbol: "^TEST", timezone: "America/New_York" };
for (const first of ["http-error", "incomplete", "network-error"]) {
  const calls = [];
  const received = await fetchIndex(definition, now, [], async url => {
    calls.push(url);
    if (calls.length === 1 && first === "network-error") throw new Error("Network unavailable");
    const chartResult = structuredClone(latestResult);
    if (calls.length === 1 && first === "incomplete") chartResult.indicators.quote[0].close[2] = null;
    return { ok: !(calls.length === 1 && first === "http-error"), status: 503,
      json: async () => ({ chart: { result: [chartResult] } }) };
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /query2/);
  assert.equal(received.observations.at(-1).date, "2026-10-26");
  assert.equal(received.error, null);
}
await assert.rejects(() => fetchIndex(definition, now, [], async () => { throw new Error("Offline"); }), /Offline/);

const validData = { attemptedAt: now.toISOString(), series: ["^NDX", "^OMX", "^N225", "^STOXX50E", "^GSPC"].map(symbol => ({
  symbol, fetchedAt: now.toISOString(), error: null, observations: [{ date: "2026-10-22", close: 100 }, { date: "2026-10-23", close: 102 }]
})) };
assert.doesNotThrow(() => validateData(validData, undefined, now));
const duplicate = structuredClone(validData);
duplicate.series[4].symbol = "^NDX";
assert.throws(() => validateData(duplicate, undefined, now), /duplicate/);
const intraday = structuredClone(validData);
intraday.series[0].observations[1].date = "2026-10-27";
assert.throws(() => validateData(intraday, undefined, now), /intraday/);
const regressed = structuredClone(validData);
regressed.series[0].observations.pop();
regressed.series[0].error = "Daily update failed";
assert.throws(() => validateData(regressed, validData, now), /older/);
// Partial failures may retain previous data, but must keep the error visible.
const partial = structuredClone(validData);
partial.series[0].error = "Daily update failed";
assert.doesNotThrow(() => validateData(partial, validData, now));

console.log("Index close, source freshness, schema, holiday and host failover checks passed.");

