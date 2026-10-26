import assert from "node:assert/strict";
import { closingObservations, dateInZone } from "../scripts/update-indices.mjs";

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
console.log("Index close filtering checks passed.");
