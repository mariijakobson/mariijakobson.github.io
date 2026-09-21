(() => {
"use strict";

const { calculateAnnualizedAmount, daysBetween, formatNumber, formatRawNumber } = window.FAUtils;

const calculator = {
  id: "bond",
  title: "Bond Interest Calculator",
  description: "Calculate accrued interest over an accrual period.",
  icon: "↗",
  results: [{ key: "amount", label: "Accrued interest" }],
  fields: [
    ["base", "Nominal / Principal amount", "1 000 000.00"],
    ["rate", "Annual coupon rate (%)", "7.75"]
  ],
  period: {
    startLabel: "Accrual start date",
    endLabel: "Accrual end date"
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
        `Accrued interest = Nominal × Rate / 100 × Days / ${denominator}`,
        `${formatRawNumber(values.base)} × ${formatRawNumber(values.rate)}% × ${days} / ${denominator} = ${formatNumber(result)}`,
        "Result is in the same currency as the entered amount."
      ]
    };
  }
};

window.FACalculators = window.FACalculators || [];
window.FACalculators.push(calculator);
})();
