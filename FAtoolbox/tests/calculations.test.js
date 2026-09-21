"use strict";

const assert = require("node:assert/strict");

global.window = globalThis;
require("../js/utils.js");
require("../js/calculators/nav-impact.js");
require("../js/calculators/fee-calculator.js");
require("../js/calculators/bond-interest.js");

const calculators = Object.fromEntries(
  window.FACalculators.map(calculator => [calculator.id, calculator])
);

const nav = calculators.nav.calculate({ base: 1_000_000, impact: 12_500 });
assert.deepEqual(nav.values, { percent: "1.2500%", bps: "125.00 bps" });
assert.deepEqual(calculators.nav.validate({ base: 0, impact: 1 }), {
  field: "base",
  message: "Current NAV must be greater than zero."
});

const fee = calculators.fee.calculate(
  { base: 1_000_000, rate: 1.5 },
  { useDates: false, days: 30, basis: "ACT/365" }
);
assert.equal(fee.values.amount, "1 232.88");

const bond = calculators.bond.calculate(
  { base: 1_000_000, rate: 7.75 },
  { useDates: false, days: 30, basis: "ACT/365" }
);
assert.equal(bond.values.amount, "6 369.86");

const { daysBetween, parseDate, parseNumber } = window.FAUtils;
assert.equal(daysBetween(parseDate("01.01.2026"), parseDate("31.01.2026"), "ACT/365"), 30);
assert.equal(daysBetween(parseDate("31.01.2026"), parseDate("28.02.2026"), "30/360"), 28);
assert.equal(parseNumber("1 250 000,50"), 1_250_000.5);
assert.ok(Number.isNaN(parseNumber("1,23,4")));

console.log("Calculation tests passed.");
