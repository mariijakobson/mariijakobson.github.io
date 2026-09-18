"use strict";

const calculators = [
  { id: "nav", title: "NAV Impact", description: "Measure the impact of an amount on your fund’s NAV.", icon: "%", result: "Impact on NAV", fields: [["base", "Current NAV", "34,836,332.14"], ["impact", "Impact amount", "12,500.00"]] },
  { id: "fee", title: "Fee Calculator", description: "Calculate an annual fee for a selected period.", icon: "÷", result: "Fee amount", fields: [["base", "Calculation base", "34,836,332.14"], ["rate", "Annual fee rate (%)", "1.50"]] },
  { id: "bond", title: "Bond Interest Calculator", description: "Calculate accrued interest over an accrual period.", icon: "↗", result: "Accrued interest", fields: [["base", "Nominal / Principal amount", "1,000,000.00"], ["rate", "Annual coupon rate (%)", "7.75"]] }
];

function fieldMarkup(id, name, label, placeholder, type = "text", wide = false) {
  return `<div class="field ${wide ? "wide" : ""}"><label for="${id}-${name}">${label}</label><input id="${id}-${name}" name="${name}" type="${type}" ${type === "text" ? 'inputmode="decimal"' : ''} placeholder="${placeholder}" required aria-describedby="${id}-${name}-error"><p class="error" id="${id}-${name}-error" hidden></p></div>`;
}

// Use the browser's local calendar; weekends are excluded, public holidays are not.
function previousBusinessDay(today = new Date()) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  do { date.setDate(date.getDate() - 1); } while ([0, 6].includes(date.getDay()));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function periodMarkup(id) {
  return `<fieldset class="mode-choice"><legend>Calculate using</legend><label><input type="radio" name="mode" value="days" checked> Number of days</label><label><input type="radio" name="mode" value="period"> Date period</label></fieldset>
    <div class="fields period-fields">
      <div class="days-fields">${fieldMarkup(id, "days", "Number of days", "e.g. 1")}</div>
      <div class="date-fields" hidden>${fieldMarkup(id, "start", id === "bond" ? "Accrual start date" : "Start date", "", "date")}${fieldMarkup(id, "end", id === "bond" ? "Accrual end date" : "End date", "", "date")}</div>
      <div class="field"><label for="${id}-basis">Day count basis</label><select id="${id}-basis" name="basis"><option>ACT/365</option><option>ACT/360</option><option>30/360</option></select></div>
    </div><p class="hint mode-hint"></p>`;
}

document.getElementById("calculators").innerHTML = calculators.map(tool => {
  const period = tool.id !== "nav";
  return `<section class="calculator"><h2 style="margin:0"><button type="button" class="accordion" id="${tool.id}-heading" aria-expanded="false" aria-controls="${tool.id}-panel"><span class="tool-icon" aria-hidden="true">${tool.icon}</span><span class="heading-copy"><strong>${tool.title}</strong><small>${tool.description}</small></span><span class="chevron" aria-hidden="true"></span></button></h2>
    <form class="panel" id="${tool.id}-panel" aria-labelledby="${tool.id}-heading" autocomplete="off" novalidate hidden>
      <div class="inputs"><div class="fields">${tool.fields.map(f => fieldMarkup(tool.id, ...f)).join("")}
      </div>${period ? periodMarkup(tool.id) : '<p class="hint">Both amounts must be in the same currency.</p>'}
      <div class="actions"><button class="primary" type="submit">Calculate <span aria-hidden="true">→</span></button><button class="reset" type="reset">Reset</button></div></div>
      <div class="result"><div class="metrics" aria-live="polite" aria-atomic="true"><div class="metric"><div class="metric-label">${tool.result}</div><div class="value" data-value>—</div></div>${!period ? '<div class="metric"><div class="metric-label">Impact in bps</div><div class="value" data-bps>—</div></div>' : ""}</div><button class="details-button" type="button" aria-expanded="false" aria-controls="${tool.id}-details" disabled>Show calculation</button><div class="calculation" id="${tool.id}-details" hidden></div></div>
    </form></section>`;
}).join("");

// A single comma or dot is decimal. With both, the rightmost is decimal.
// Repeated identical separators are accepted only as valid thousands groups.
function parseAmount(raw) {
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
    value = commaDecimal ? value.replaceAll(".", "").replace(",", ".") : value.replaceAll(",", "");
  } else {
    const separators = value.match(/[.,]/g) || [];
    if (separators.length > 1) {
      if (!/^\d{1,3}(?:,\d{3}){2,}$/.test(value) && !/^\d{1,3}(?:\.\d{3}){2,}$/.test(value)) return NaN;
      value = value.replace(/[.,]/g, "");
    } else {
      value = value.replace(",", ".");
    }
  }
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return NaN;
  return Number(sign + value);
}

function formatNumber(value, decimals = 2) {
  return (Object.is(value, -0) ? 0 : value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

// UTC dates avoid daylight-saving shifts. 30/360 follows ISDA Bond Basis:
// cap the start day at 30; cap an end day of 31 only if start day is 30.
function dayCount(start, end, basis) {
  if (basis !== "30/360") return (end - start) / 86400000;
  const d1 = Math.min(start.getUTCDate(), 30);
  const d2 = d1 === 30 ? Math.min(end.getUTCDate(), 30) : end.getUTCDate();
  return 360 * (end.getUTCFullYear() - start.getUTCFullYear()) + 30 * (end.getUTCMonth() - start.getUTCMonth()) + d2 - d1;
}

document.querySelectorAll(".accordion").forEach(button => {
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    document.querySelectorAll(".accordion").forEach(other => {
      const expanded = other === button && open;
      other.setAttribute("aria-expanded", String(expanded));
      document.getElementById(other.getAttribute("aria-controls")).hidden = !expanded;
    });
  });
});

calculators.forEach(tool => {
  const form = document.getElementById(`${tool.id}-panel`);
  const toggle = form.querySelector(".details-button");
  const details = form.querySelector(".calculation");

  function updateMode() {
    if (tool.id === "nav") return;
    const period = form.elements.mode.value === "period";
    form.querySelector(".days-fields").hidden = period;
    form.querySelector(".date-fields").hidden = !period;
    form.elements.days.disabled = period;
    form.elements.start.disabled = !period;
    form.elements.end.disabled = !period;
    form.querySelector(".mode-hint").textContent = period
      ? "End date excluded: same dates = 0 days. Default: previous weekday (holidays not excluded)."
      : "Enter whole days. For 30/360, enter convention-adjusted days or use Date period.";
  }

  function setPeriodDefaults() {
    if (tool.id === "nav") return;
    form.elements.days.defaultValue = "1";
    form.elements.days.value = "1";
    const date = previousBusinessDay();
    form.elements.start.defaultValue = date;
    form.elements.end.defaultValue = date;
    form.elements.start.value = date;
    form.elements.end.value = date;
  }

  setPeriodDefaults();
  updateMode();

  function clearResult() {
    form.querySelectorAll(".value").forEach(value => { value.textContent = "—"; });
    details.hidden = true;
    details.textContent = "";
    toggle.disabled = true;
    toggle.textContent = "Show calculation";
    toggle.setAttribute("aria-expanded", "false");
  }

  function clearErrors() {
    form.querySelectorAll(".error").forEach(error => { error.hidden = true; error.textContent = ""; });
    form.querySelectorAll("input").forEach(input => input.removeAttribute("aria-invalid"));
  }

  function setError(name, message) {
    const input = form.elements[name];
    input.setAttribute("aria-invalid", "true");
    const error = document.getElementById(`${tool.id}-${name}-error`);
    error.textContent = message;
    error.hidden = false;
  }

  form.addEventListener("input", () => { clearResult(); clearErrors(); });
  form.addEventListener("change", () => { updateMode(); clearResult(); clearErrors(); });
  form.addEventListener("reset", () => {
    clearResult();
    clearErrors();
    // Native form reset completes after this event.
    queueMicrotask(() => { setPeriodDefaults(); updateMode(); });
  });
  toggle.addEventListener("click", () => {
    details.hidden = !details.hidden;
    toggle.textContent = details.hidden ? "Show calculation" : "Hide calculation";
    toggle.setAttribute("aria-expanded", String(!details.hidden));
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    clearErrors();
    clearResult();
    const numbers = {};
    tool.fields.forEach(([name]) => {
      const raw = form.elements[name].value;
      numbers[name] = parseAmount(raw);
      if (!raw.trim()) setError(name, "Enter a value.");
      else if (!Number.isFinite(numbers[name])) setError(name, "Enter a valid number, for example 12,500.50.");
      else if (name === "base" && tool.id === "nav" && numbers[name] <= 0) setError(name, "Current NAV must be greater than zero.");
      else if (name === "rate" && numbers[name] < 0) setError(name, "The annual rate cannot be negative.");
    });
    let start, end;
    if (tool.id !== "nav" && form.elements.mode.value === "period") {
      start = parseDate(form.elements.start.value);
      end = parseDate(form.elements.end.value);
      if (!start) setError("start", "Enter a valid start date.");
      if (!end) setError("end", "Enter a valid end date.");
      if (start && end && start > end) setError("end", "End date must be on or after start date.");
    }
    if (tool.id !== "nav" && form.elements.mode.value === "days") {
      const raw = form.elements.days.value.trim();
      numbers.days = parseAmount(raw);
      if (!raw) setError("days", "Enter the number of days.");
      else if (!Number.isSafeInteger(numbers.days) || numbers.days < 0) setError("days", "Enter a non-negative whole number of days.");
    }
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) { firstInvalid.focus(); return; }

    let result, steps;
    if (tool.id === "nav") {
      result = numbers.impact / numbers.base * 100;
      const bps = numbers.impact / numbers.base * 10000;
      if (!Number.isFinite(result) || !Number.isFinite(bps)) { setError("impact", "These values are too large to calculate. Use smaller amounts."); form.elements.impact.focus(); return; }
      form.querySelector("[data-value]").textContent = `${formatNumber(result, 4)}%`;
      form.querySelector("[data-bps]").textContent = `${formatNumber(bps)} bps`;
      steps = [`Impact % = Impact amount / Current NAV × 100`, `${numbers.impact.toLocaleString("en-US", {maximumFractionDigits: 20})} / ${numbers.base.toLocaleString("en-US", {maximumFractionDigits: 20})} × 100 = ${formatNumber(result, 4)}%`, `Impact bps = Impact amount / Current NAV × 10,000`, `${numbers.impact.toLocaleString("en-US", {maximumFractionDigits: 20})} / ${numbers.base.toLocaleString("en-US", {maximumFractionDigits: 20})} × 10,000 = ${formatNumber(bps)} bps`];
    } else {
      const basis = form.elements.basis.value;
      const usePeriod = form.elements.mode.value === "period";
      const days = usePeriod ? dayCount(start, end, basis) : numbers.days;
      const denominator = basis === "ACT/365" ? 365 : 360;
      const fraction = days / denominator;
      result = numbers.base * (numbers.rate / 100) * fraction;
      if (!Number.isFinite(result)) { setError("base", "These values are too large to calculate. Use smaller amounts."); form.elements.base.focus(); return; }
      form.querySelector("[data-value]").textContent = formatNumber(result);
      steps = [`Day count: ${days} days · ${basis}${basis === "30/360" ? " (Bond Basis / ISDA)" : ""}`, usePeriod ? `Period: ${form.elements.start.value} to ${form.elements.end.value} (end excluded).` : "Days entered directly; no date adjustments applied.", `Day count fraction: ${days} / ${denominator} = ${formatNumber(fraction, 8)}`, `${tool.result} = ${tool.id === "fee" ? "Base" : "Nominal"} × Rate / 100 × Days / ${denominator}`, `${numbers.base.toLocaleString("en-US", {maximumFractionDigits: 20})} × ${numbers.rate.toLocaleString("en-US", {maximumFractionDigits: 20})}% × ${days} / ${denominator} = ${formatNumber(result)}`];
    }
    // Only text nodes are used for calculation output; entered content is never HTML.
    if (tool.id !== "nav") steps.push("Result is in the same currency as the entered amount.");
    steps.forEach(step => { const p = document.createElement("p"); p.textContent = step; details.append(p); });
    toggle.disabled = false;
  });
});
