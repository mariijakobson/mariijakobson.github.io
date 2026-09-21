(() => {
"use strict";

const calculatorRoot = document.getElementById("calculators");

if (!window.FAUtils || !Array.isArray(window.FACalculators) || !window.FAInitializeChartOfAccounts) {
  calculatorRoot.textContent = "The toolbox could not be initialized. Check that all application files are present.";
  return;
}

const { parseDate, parseNumber, previousBusinessDay } = window.FAUtils;
const calculators = window.FACalculators;

function fieldMarkup(id, name, label, placeholder, type = "text") {
  const dateAttributes = type === "date" ? ' maxlength="10"' : "";
  const inputMode = type === "date" ? "numeric" : "decimal";
  const displayedPlaceholder = type === "date" ? "pp.kk.aaaa" : placeholder;
  return `<div class="field"><label for="${id}-${name}">${label}</label><input id="${id}-${name}" name="${name}" type="text" inputmode="${inputMode}" placeholder="${displayedPlaceholder}"${dateAttributes} required aria-describedby="${id}-${name}-error"><p class="error" id="${id}-${name}-error" hidden></p></div>`;
}

function periodMarkup(calculator) {
  const { id, period } = calculator;
  return `<fieldset class="mode-choice"><legend>Calculate using</legend><label><input type="radio" name="mode" value="days" checked> Number of days</label><label><input type="radio" name="mode" value="period"> Date period</label></fieldset>
    <div class="fields period-fields">
      <div class="days-fields">${fieldMarkup(id, "days", "Number of days", "e.g. 1")}</div>
      <div class="date-fields" hidden>${fieldMarkup(id, "start", period.startLabel, "", "date")}${fieldMarkup(id, "end", period.endLabel, "", "date")}</div>
      <div class="field"><label for="${id}-basis">Day count basis</label><select id="${id}-basis" name="basis"><option>ACT/365</option><option>ACT/360</option><option>30/360</option></select></div>
    </div><p class="hint mode-hint"></p>`;
}

function calculatorMarkup(calculator) {
  const metrics = calculator.results.map(result =>
    `<div class="metric"><div class="metric-label">${result.label}</div><div class="value" data-result="${result.key}">—</div></div>`
  ).join("");
  const supplementalFields = calculator.period
    ? periodMarkup(calculator)
    : `<p class="hint">${calculator.hint || ""}</p>`;

  return `<section class="calculator"><h2><button type="button" class="accordion" id="${calculator.id}-heading" aria-expanded="false" aria-controls="${calculator.id}-panel"><span class="tool-icon" aria-hidden="true">${calculator.icon}</span><span class="heading-copy"><strong>${calculator.title}</strong><small>${calculator.description}</small></span><span class="chevron" aria-hidden="true"></span></button></h2>
    <form class="panel" id="${calculator.id}-panel" aria-labelledby="${calculator.id}-heading" autocomplete="off" novalidate hidden>
      <div class="inputs"><div class="fields">${calculator.fields.map(field => fieldMarkup(calculator.id, ...field)).join("")}</div>${supplementalFields}<div class="actions"><button class="primary" type="submit">Calculate <span aria-hidden="true">→</span></button><button class="reset" type="reset">Reset</button></div></div>
      <div class="result"><div class="metrics" aria-live="polite" aria-atomic="true">${metrics}</div><button class="details-button" type="button" aria-expanded="false" aria-controls="${calculator.id}-details" disabled>Show calculation</button><div class="calculation" id="${calculator.id}-details" hidden></div></div>
    </form></section>`;
}

function setError(form, calculatorId, name, message) {
  const input = form.elements[name];
  input.setAttribute("aria-invalid", "true");
  const error = document.getElementById(`${calculatorId}-${name}-error`);
  error.textContent = message;
  error.hidden = false;
}

function initializeCalculator(calculator) {
  const form = document.getElementById(`${calculator.id}-panel`);
  const detailsButton = form.querySelector(".details-button");
  const details = form.querySelector(".calculation");

  function clearResult() {
    form.querySelectorAll(".value").forEach(value => { value.textContent = "—"; });
    details.replaceChildren();
    details.hidden = true;
    detailsButton.disabled = true;
    detailsButton.textContent = "Show calculation";
    detailsButton.setAttribute("aria-expanded", "false");
  }

  function clearErrors() {
    form.querySelectorAll(".error").forEach(error => {
      error.hidden = true;
      error.textContent = "";
    });
    form.querySelectorAll("input").forEach(input => input.removeAttribute("aria-invalid"));
  }

  function updateMode() {
    if (!calculator.period) return;
    const useDates = form.elements.mode.value === "period";
    form.querySelector(".days-fields").hidden = useDates;
    form.querySelector(".date-fields").hidden = !useDates;
    form.elements.days.disabled = useDates;
    form.elements.start.disabled = !useDates;
    form.elements.end.disabled = !useDates;
    form.querySelector(".mode-hint").textContent = useDates
      ? "End date excluded: same dates = 0 days. Default: previous weekday (holidays not excluded)."
      : "Enter whole days. For 30/360, enter convention-adjusted days or use Date period.";
  }

  function setPeriodDefaults() {
    if (!calculator.period) return;
    const date = previousBusinessDay();
    form.elements.days.defaultValue = "1";
    form.elements.days.value = "1";
    form.elements.start.defaultValue = date;
    form.elements.start.value = date;
    form.elements.end.defaultValue = date;
    form.elements.end.value = date;
  }

  setPeriodDefaults();
  updateMode();

  form.addEventListener("input", () => {
    clearResult();
    clearErrors();
  });
  form.addEventListener("change", () => {
    updateMode();
    clearResult();
    clearErrors();
  });
  form.addEventListener("reset", () => {
    clearResult();
    clearErrors();
    queueMicrotask(() => {
      setPeriodDefaults();
      updateMode();
    });
  });
  detailsButton.addEventListener("click", () => {
    details.hidden = !details.hidden;
    detailsButton.textContent = details.hidden ? "Show calculation" : "Hide calculation";
    detailsButton.setAttribute("aria-expanded", String(!details.hidden));
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    clearErrors();
    clearResult();

    const values = {};
    calculator.fields.forEach(([name]) => {
      const raw = form.elements[name].value;
      values[name] = parseNumber(raw);
      if (!raw.trim()) setError(form, calculator.id, name, "Enter a value.");
      else if (!Number.isFinite(values[name])) setError(form, calculator.id, name, "Enter a valid number, for example 12 500.50.");
    });

    let period = null;
    if (calculator.period) {
      const useDates = form.elements.mode.value === "period";
      period = { useDates, basis: form.elements.basis.value };
      if (useDates) {
        period.startText = form.elements.start.value;
        period.endText = form.elements.end.value;
        period.start = parseDate(period.startText);
        period.end = parseDate(period.endText);
        if (!period.start) setError(form, calculator.id, "start", "Enter a valid start date in DD.MM.YYYY format.");
        if (!period.end) setError(form, calculator.id, "end", "Enter a valid end date in DD.MM.YYYY format.");
        if (period.start && period.end && period.start > period.end) setError(form, calculator.id, "end", "End date must be on or after start date.");
      } else {
        const rawDays = form.elements.days.value.trim();
        period.days = parseNumber(rawDays);
        if (!rawDays) setError(form, calculator.id, "days", "Enter the number of days.");
        else if (!Number.isSafeInteger(period.days) || period.days < 0) setError(form, calculator.id, "days", "Enter a non-negative whole number of days.");
      }
    }

    const calculatorError = calculator.validate(values);
    if (calculatorError && !form.elements[calculatorError.field].hasAttribute("aria-invalid")) {
      setError(form, calculator.id, calculatorError.field, calculatorError.message);
    }

    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const output = calculator.calculate(values, period);
    if (output.error) {
      setError(form, calculator.id, output.error.field, output.error.message);
      form.elements[output.error.field].focus();
      return;
    }

    calculator.results.forEach(result => {
      form.querySelector(`[data-result="${result.key}"]`).textContent = output.values[result.key];
    });
    output.steps.forEach(step => {
      const paragraph = document.createElement("p");
      paragraph.textContent = step;
      details.append(paragraph);
    });
    detailsButton.disabled = false;
  });
}

calculatorRoot.innerHTML = calculators.map(calculatorMarkup).join("");
document.getElementById("tool-count").textContent = `${String(calculators.length).padStart(2, "0")} tools`;

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

calculators.forEach(initializeCalculator);
window.FAInitializeChartOfAccounts();
})();
