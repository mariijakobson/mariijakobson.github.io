(() => {
"use strict";

function parseNumber(raw) {
  let value = raw.trim().replace(/[\u00a0\u202f]/g, " ");
  if (!value) return NaN;

  const sign = /^[+-]/.test(value) ? value[0] : "";
  if (sign) value = value.slice(1);
  if (!/^[\d., ]+$/.test(value)) return NaN;

  if (value.includes(" ")) {
    if (!/^\d{1,3}(?: \d{3})+(?:[.,]\d+)?$/.test(value)) return NaN;
    value = value.replaceAll(" ", "");
  }

  if (value.includes(",") && value.includes(".")) {
    const commaDecimal = value.lastIndexOf(",") > value.lastIndexOf(".");
    const valid = commaDecimal
      ? /^\d{1,3}(?:\.\d{3})+,\d+$/
      : /^\d{1,3}(?:,\d{3})+\.\d+$/;
    if (!valid.test(value)) return NaN;
    value = commaDecimal
      ? value.replaceAll(".", "").replace(",", ".")
      : value.replaceAll(",", "");
  } else {
    const separators = value.match(/[.,]/g) || [];
    if (separators.length > 1) {
      const commaGroups = /^\d{1,3}(?:,\d{3}){2,}$/.test(value);
      const dotGroups = /^\d{1,3}(?:\.\d{3}){2,}$/.test(value);
      if (!commaGroups && !dotGroups) return NaN;
      value = value.replace(/[.,]/g, "");
    } else {
      value = value.replace(",", ".");
    }
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return NaN;
  return Number(sign + value);
}

function formatNumber(value, decimals = 2) {
  return (Object.is(value, -0) ? 0 : value)
    .toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
    .replaceAll(",", " ");
}

function formatRawNumber(value) {
  return value
    .toLocaleString("en-US", { maximumFractionDigits: 20 })
    .replaceAll(",", " ");
}

function parseDate(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, day, month, year] = match;
  if (Number(year) === 0) return null;

  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso
    ? date
    : null;
}

function daysBetween(start, end, basis) {
  if (basis !== "30/360") return (end - start) / 86400000;

  const startDay = Math.min(start.getUTCDate(), 30);
  const endDay = startDay === 30 ? Math.min(end.getUTCDate(), 30) : end.getUTCDate();
  return 360 * (end.getUTCFullYear() - start.getUTCFullYear())
    + 30 * (end.getUTCMonth() - start.getUTCMonth())
    + endDay - startDay;
}

function calculateAnnualizedAmount(amount, rate, days, basis) {
  const denominator = basis === "ACT/365" ? 365 : 360;
  const fraction = days / denominator;
  return {
    denominator,
    fraction,
    result: amount * (rate / 100) * fraction
  };
}

function previousBusinessDay(today = new Date()) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  do {
    date.setDate(date.getDate() - 1);
  } while ([0, 6].includes(date.getDay()));

  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

window.FAUtils = {
  calculateAnnualizedAmount,
  daysBetween,
  formatNumber,
  formatRawNumber,
  parseDate,
  parseNumber,
  previousBusinessDay
};
})();
