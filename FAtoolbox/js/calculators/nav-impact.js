(() => {
"use strict";

const { formatNumber, formatRawNumber } = window.FAUtils;

const calculator = {
  id: "nav",
  title: "NAV Impact",
  description: "Measure the impact of an amount on your fund’s NAV.",
  icon: "%",
  results: [
    { key: "percent", label: "Impact on NAV" },
    { key: "bps", label: "Impact in bps" }
  ],
  fields: [
    ["base", "Current NAV", "34 836 332.14"],
    ["impact", "Impact amount", "12 500.00"]
  ],
  hint: "Both amounts must be in the same currency.",

  validate(values) {
    if (values.base <= 0) return { field: "base", message: "Current NAV must be greater than zero." };
    return null;
  },

  calculate(values) {
    const percent = values.impact / values.base * 100;
    const bps = values.impact / values.base * 10000;
    if (!Number.isFinite(percent) || !Number.isFinite(bps)) {
      return { error: { field: "impact", message: "These values are too large to calculate. Use smaller amounts." } };
    }

    return {
      values: {
        percent: `${formatNumber(percent, 4)}%`,
        bps: `${formatNumber(bps)} bps`
      },
      steps: [
        "Impact % = Impact amount / Current NAV × 100",
        `${formatRawNumber(values.impact)} / ${formatRawNumber(values.base)} × 100 = ${formatNumber(percent, 4)}%`,
        "Impact bps = Impact amount / Current NAV × 10,000",
        `${formatRawNumber(values.impact)} / ${formatRawNumber(values.base)} × 10,000 = ${formatNumber(bps)} bps`
      ]
    };
  }
};

window.FACalculators = window.FACalculators || [];
window.FACalculators.push(calculator);
})();
