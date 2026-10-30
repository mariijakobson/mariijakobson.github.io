(() => {
"use strict";
const cards = document.getElementById("indices-values");
const status = document.getElementById("indices-status");
const number = value => new Intl.NumberFormat("et-EE", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const signed = value => `${value > 0 ? "+" : ""}${new Intl.NumberFormat("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: value !== 0 && Math.abs(value) < .01 ? 3 : 2 }).format(value)}`;
const dateLabel = value => new Intl.DateTimeFormat("et-EE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value + "T12:00:00Z"));
async function initialize() {
  try {
    // Bust intermediary caches as well as the browser cache after publication.
    const response = await fetch(`data/indices.json?v=${Math.floor(Date.now() / 300000)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Could not load closing data");
    const data = await response.json();
    if (!Array.isArray(data.series) || data.series.length !== 5) throw new Error("Invalid index data");
    const ordered = [...data.series].sort((a, b) => Number(b.symbol === "^GSPC") - Number(a.symbol === "^GSPC"));
    const closingDates = [];
    const elements = ordered.map(item => {
      const observations = (Array.isArray(item.observations) ? item.observations : []).filter(point =>
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.close) && point.close > 0
      ).sort((a, b) => a.date.localeCompare(b.date));
      const last = observations.at(-1);
      const previous = observations.at(-2);
      closingDates.push(last?.date || null);
      const card = document.createElement("a");
      card.className = "index-card";
      card.href = `https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}/`;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.title = last ? `Close: ${dateLabel(last.date)}${previous ? ` · Compared with ${dateLabel(previous.date)}` : ""} · Yahoo Finance` : "Closing data unavailable";
      const name = document.createElement("h3");
      name.textContent = item.name;
      const value = document.createElement("p");
      value.className = "index-close";
      value.textContent = last ? number(last.close) : "Unavailable";
      const date = document.createElement("p");
      date.className = "index-date";
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
      card.append(name, change, value, date, comparison);
      return card;
    });
    const commonDate = closingDates.every(date => date && date === closingDates[0]);
    document.getElementById("indices-date").textContent = commonDate ? dateLabel(closingDates[0]) : "Dates vary by market";
    elements.forEach(card => {
      const date = card.querySelector(".index-date");
      date.classList.toggle("sr-only", commonDate);
      const linkHint = document.createElement("span");
      linkHint.className = "sr-only";
      linkHint.textContent = "Open Yahoo Finance in a new tab";
      card.append(linkHint);
    });
    cards.replaceChildren(...elements);
    // The independent morning refresh starts at 07:00 Estonia time, including DST.
    const localDate = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tallinn", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
    const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Tallinn", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    const expected = localDate(new Date(Date.now() - (localHour < 7 ? 86400000 : 0)));
    const outdated = data.series.some(item => item.error || !Number.isFinite(Date.parse(item.fetchedAt)) || localDate(new Date(item.fetchedAt)) < expected);
    status.textContent = outdated
      ? "Data update is overdue or failed. Check the closing date shown for each index."
      : "% change vs previous close · Select an index to open Yahoo Finance";
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
setInterval(initialize, 5 * 60 * 1000);
})();


