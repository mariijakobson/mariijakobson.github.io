(() => {
"use strict";

const { calculateAnnualizedAmount, daysBetween, formatNumber, formatRawNumber } = window.FAUtils;

const calculator = {
  id: "fee",
  title: "Fee Calculator",
  description: "Calculate an annual fee for a selected period.",
  icon: "÷",
  results: [{ key: "amount", label: "Fee amount" }],
  fields: [
    ["base", "Calculation base", "34 836 332.14"],
    ["rate", "Annual fee rate (%)", "1.50"]
  ],
  period: {
    startLabel: "Start date",
    endLabel: "End date"
  },

  validate(values) {
    if (values.rate < 0) return { field: "rate", message: "The annual rate cannot be negative." };
    return null;
  },

  calculate(values, period) {
    const days = period.useDates
      ? daysBetween(period.start, period.end, period.basis)
      : period.days;
    const { denominator, fraction, result } = calculateAnnualizedAmount(
      values.base,
      values.rate,
      days,
      period.basis
    );

    if (!Number.isFinite(result)) {
      return { error: { field: "base", message: "These values are too large to calculate. Use smaller amounts." } };
    }

    return {
      values: { amount: formatNumber(result) },
      steps: [
        `Day count: ${days} days · ${period.basis}${period.basis === "30/360" ? " (Bond Basis / ISDA)" : ""}`,
        period.useDates ? `Period: ${period.startText} to ${period.endText} (end excluded).` : "Days entered directly; no date adjustments applied.",
        `Day count fraction: ${days} / ${denominator} = ${formatNumber(fraction, 8)}`,
        `Fee amount = Base × Rate / 100 × Days / ${denominator}`,
        `${formatRawNumber(values.base)} × ${formatRawNumber(values.rate)}% × ${days} / ${denominator} = ${formatNumber(result)}`,
        "Result is in the same currency as the entered amount."
      ]
    };
  }
};

window.FACalculators = window.FACalculators || [];
window.FACalculators.push(calculator);
})();
