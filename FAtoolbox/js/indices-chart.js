(() => {
"use strict";
const cards = document.getElementById("indices-values");
const status = document.getElementById("indices-status");
const number = value => new Intl.NumberFormat("et-EE", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const signed = value => `${value > 0 ? "+" : ""}${number(value)}`;
const dateLabel = value => new Intl.DateTimeFormat("et-EE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value + "T12:00:00Z"));
async function initialize() {
  try {
    const response = await fetch("data/indices.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load closing data");
    const data = await response.json();
    if (!Array.isArray(data.series) || data.series.length !== 5) throw new Error("Invalid index data");
    const elements = data.series.map(item => {
      const observations = (Array.isArray(item.observations) ? item.observations : []).filter(point =>
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.close) && point.close > 0
      ).sort((a, b) => a.date.localeCompare(b.date));
      const last = observations.at(-1);
      const previous = observations.at(-2);
      const card = document.createElement("article");
      card.className = "index-card";
      card.title = last ? `Close: ${dateLabel(last.date)}${previous ? ` · Compared with ${dateLabel(previous.date)}` : ""} · Yahoo Finance` : "Closing data unavailable";
      const name = document.createElement("h3");
      name.textContent = item.name;
      const value = document.createElement("p");
      value.className = "index-close";
      value.textContent = last ? number(last.close) : "Unavailable";
      const date = document.createElement("p");
      date.className = "sr-only";
      date.textContent = last ? `Close · ${dateLabel(last.date)}` : "Closing data unavailable";
      const change = document.createElement("p");
      change.className = "index-change";
      const comparison = document.createElement("p");
      comparison.className = "sr-only";
      if (last && previous) {
        const difference = last.close - previous.close;
        const percent = difference / previous.close * 100;
        change.textContent = `${signed(percent)}%`;
        change.classList.add(difference > 0 ? "is-positive" : difference < 0 ? "is-negative" : "is-unchanged");
        comparison.textContent = `vs ${dateLabel(previous.date)}`;
      } else {
        change.textContent = "Change unavailable";
      }
      card.append(name, value, date, change, comparison);
      return card;
    });
    cards.replaceChildren(...elements);
    const outdated = data.series.some(item => item.error || !Number.isFinite(Date.parse(item.fetchedAt)) || Date.now() - Date.parse(item.fetchedAt) > 36 * 60 * 60 * 1000);
    status.textContent = outdated
      ? "Data update is overdue or failed. Check the closing date shown for each index."
      : "Previous trading-day closes · Yahoo Finance · Changes are compared with the preceding trading-day close.";
    status.classList.toggle("indices-warning", outdated);
    status.classList.toggle("sr-only", !outdated);
  } catch {
    status.textContent = "Closing data could not be loaded. Try refreshing the page. Check the dates of any previously loaded values.";
    status.classList.add("indices-warning");
    status.classList.remove("sr-only");
  }
}
initialize();
// Pick up newly published closing data in tabs left open overnight.
setInterval(initialize, 60 * 60 * 1000);
})();
